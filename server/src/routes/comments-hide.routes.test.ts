import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.ts";
import { setEmit, type WideEvent } from "../lib/wide-event.ts";
import { UserRepository } from "../repositories/users.repository.ts";
import { resetDatabase, startTestApi } from "../test/helpers.ts";
import { signToken } from "../utils/jwt.ts";

let api: Awaited<ReturnType<typeof startTestApi>>;
let events: WideEvent[];
beforeAll(async () => {
  api = await startTestApi();
});
afterAll(async () => {
  await api.close();
});
beforeEach(async () => {
  await resetDatabase();
  events = [];
  setEmit((event) => events.push(event));
});
afterEach(() => setEmit(null));

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

async function person(name: string) {
  const user = await UserRepository.createWithChannel({
    email: `${name.toLowerCase()}@example.com`,
    name,
    nameKey: name.toLowerCase(),
    password: "unused",
  });
  return { user, bearer: { Authorization: `Bearer ${await signToken(user.id)}` } };
}
type Who = Awaited<ReturnType<typeof person>>;

async function video(owner: Who) {
  const channel = await prisma.channel.findUniqueOrThrow({ where: { userId: owner.user.id } });
  return (
    await prisma.video.create({
      data: { channelId: channel.id, title: "Holiday", description: "Two weeks away", status: "READY", visibility: "PUBLIC" },
    })
  ).id;
}

const write = async (videoId: string, who: Who, body: string, parentId?: string) =>
  (await (await api.request(`/videos/${videoId}/comments`, { method: "POST", json: { body, parentId }, headers: who.bearer })).json())
    .comment;
const hide = (videoId: string, commentId: string, who: Who | null) =>
  api.request(`/videos/${videoId}/comments/${commentId}/hide`, { method: "POST", headers: who?.bearer });
const unhide = (videoId: string, commentId: string, who: Who | null) =>
  api.request(`/videos/${videoId}/comments/${commentId}/unhide`, { method: "POST", headers: who?.bearer });
const top = async (videoId: string, who: Who | null = null) =>
  (await (await api.request(`/videos/${videoId}/comments`, { headers: who?.bearer })).json()).comments;
const repliesOf = async (videoId: string, commentId: string, who: Who | null = null) => {
  const response = await api.request(`/videos/${videoId}/comments/${commentId}/replies`, { headers: who?.bearer });
  return response.status === 200 ? (await response.json()).replies : response.status;
};
const hiddenList = (videoId: string, who: Who | null, query = "") =>
  api.request(`/videos/${videoId}/comments/hidden${query}`, { headers: who?.bearer });
const count = async (videoId: string, who: Who | null = null) =>
  (await (await api.request(`/videos/${videoId}/watch`, { headers: who?.bearer })).json()).video;
const bodies = (list: { body: string | null }[]) => list.map((c) => c.body);

describe("hiding and un-hiding", () => {
  it("lets only the owner hide and un-hide a Comment or Reply; anyone else gets 404", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada);
    const comment = await write(id, grace, "hello");
    const reply = await write(id, grace, "answer", comment.id);

    expect((await hide(id, comment.id, grace)).status).toBe(404);
    expect((await hide(id, comment.id, null)).status).toBe(401);
    expect((await hide(id, "missing", ada)).status).toBe(404);
    expect((await hide(id, reply.id, ada)).status).toBe(204);
    expect((await hide(id, comment.id, ada)).status).toBe(204);
    expect((await hide(id, comment.id, ada)).status).toBe(204); // repeating changes nothing
    expect((await unhide(id, comment.id, grace)).status).toBe(404);
    expect((await unhide(id, comment.id, ada)).status).toBe(204);
    expect((await unhide(id, comment.id, ada)).status).toBe(204);
    expect((await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } })).hiddenAt).toBeNull();
  });

  it("is gone for Viewers and other Users, but the author still sees it as normal", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const linus = await person("Linus-Torvalds");
    const id = await video(ada);
    const comment = await write(id, grace, "mine");
    await write(id, linus, "other");
    await hide(id, comment.id, ada);

    expect(bodies(await top(id))).toEqual(["other"]);
    expect(bodies(await top(id, linus))).toEqual(["other"]);
    expect(bodies(await top(id, ada))).toEqual(["other"]);
    const mine = await top(id, grace);
    expect(bodies(mine)).toEqual(["other", "mine"]);
    // The author is not told: nothing marks their Comment as hidden.
    expect(mine.every((c: { hidden: boolean }) => c.hidden === false)).toBe(true);
    expect((await count(id)).comments).toBe(1);
  });

  it("hides the Replies with a Comment and restores them, except Replies hidden on their own", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const linus = await person("Linus-Torvalds");
    const id = await video(ada);
    const parent = await write(id, grace, "parent");
    const one = await write(id, linus, "one", parent.id);
    await write(id, linus, "two", parent.id);
    await hide(id, one.id, ada);
    expect(bodies(await repliesOf(id, parent.id))).toEqual(["two"]);
    expect((await count(id)).comments).toBe(2);

    await hide(id, parent.id, ada);
    expect(await repliesOf(id, parent.id)).toBe(404);
    expect(await top(id)).toHaveLength(0);
    expect((await count(id)).comments).toBe(0);
    // The author of the hidden Comment is told nothing: their thread looks the same, minus the Reply hidden on its own.
    expect(bodies(await repliesOf(id, parent.id, grace))).toEqual(["two"]);
    expect((await top(id, grace))[0].replyCount).toBe(1);

    await unhide(id, parent.id, ada);
    expect(bodies(await repliesOf(id, parent.id))).toEqual(["two"]);
    expect((await count(id)).comments).toBe(2);
  });

  it("refuses new Replies to a hidden Comment, to everyone, and to its Replies", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada);
    const parent = await write(id, grace, "parent");
    const reply = await write(id, ada, "reply", parent.id);
    const answer = (who: Who, parentId: string) =>
      api.request(`/videos/${id}/comments`, { method: "POST", json: { body: "x", parentId }, headers: who.bearer });

    await hide(id, parent.id, ada);
    expect((await answer(grace, parent.id)).status).toBe(409);
    expect((await answer(ada, parent.id)).status).toBe(409);
    expect((await answer(grace, reply.id)).status).toBe(409);
    await unhide(id, parent.id, ada);
    await hide(id, reply.id, ada);
    expect((await answer(grace, reply.id)).status).toBe(409);
    expect((await answer(grace, parent.id)).status).toBe(201);
  });

  it("lets the author edit or delete a hidden Comment; editing does not un-hide it", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada);
    const comment = await write(id, grace, "first");
    await hide(id, comment.id, ada);

    const edited = await api.request(`/videos/${id}/comments/${comment.id}`, {
      method: "PATCH",
      json: { body: "second" },
      headers: grace.bearer,
    });
    expect(edited.status).toBe(200);
    expect(await top(id)).toHaveLength(0);
    expect((await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } })).hiddenAt).not.toBeNull();

    const removed = await api.request(`/videos/${id}/comments/${comment.id}`, { method: "DELETE", headers: grace.bearer });
    expect(removed.status).toBe(204);
    expect((await (await hiddenList(id, ada)).json()).total).toBe(0);
  });
});

describe("the owner's hidden list", () => {
  it("lists hidden Comments and Replies newest first with a total, paged, for the owner only", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada);
    const start = Date.now() - 100_000;
    const made = await prisma.comment.createMany({
      data: Array.from({ length: 22 }, (_, n) => ({
        videoId: id,
        authorId: grace.user.id,
        body: `c${n}`,
        createdAt: new Date(start + n * 1000),
        hiddenAt: n < 21 ? new Date() : null,
      })),
    });
    expect(made.count).toBe(22);
    const parent = await write(id, grace, "parent");
    const reply = await write(id, grace, "reply", parent.id);
    await hide(id, reply.id, ada);
    await hide(id, parent.id, ada);

    const first = await (await hiddenList(id, ada)).json();
    expect(first.total).toBe(23);
    expect(first).toMatchObject({ page: 1, hasMore: true });
    expect(first.comments).toHaveLength(20);
    expect(first.comments[0]).toMatchObject({ body: "reply", parentId: parent.id, hidden: true, authorName: "Grace-Hopper" });

    const second = await (await hiddenList(id, ada, "?page=2")).json();
    expect(second.comments).toHaveLength(3);
    expect(second.hasMore).toBe(false);

    expect((await hiddenList(id, grace)).status).toBe(404);
    expect((await hiddenList(id, null)).status).toBe(401);
  });
});

describe("request events", () => {
  it("record hide and unhide with the Comment", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada);
    const comment = await write(id, ada, "secret words");
    await hide(id, comment.id, ada);
    await unhide(id, comment.id, ada);
    await hiddenList(id, ada);
    await settle();

    const found = events.filter((e) => e.commentAction);
    expect(found.map((e) => e.commentAction)).toEqual(["create", "hide", "unhide", "hidden"]);
    expect(found[1]).toMatchObject({ commentId: comment.id, videoId: id });
    expect(JSON.stringify(events)).not.toContain("secret words");
  });
});
