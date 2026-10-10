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

async function video(
  owner: Awaited<ReturnType<typeof person>>,
  data: { status?: "PROCESSING" | "READY"; visibility?: "PRIVATE" | "PUBLIC"; deletedAt?: Date } = {},
) {
  const channel = await prisma.channel.findUniqueOrThrow({ where: { userId: owner.user.id } });
  const created = await prisma.video.create({
    data: {
      channelId: channel.id,
      title: "Holiday",
      description: "Two weeks away",
      status: data.status ?? "READY",
      visibility: data.visibility ?? "PUBLIC",
      deletedAt: data.deletedAt,
    },
  });
  return created.id;
}

type Who = Awaited<ReturnType<typeof person>>;
const write = (videoId: string, who: Who | null, json: unknown) =>
  api.request(`/videos/${videoId}/comments`, { method: "POST", json, headers: who?.bearer });
const list = (videoId: string, who: Who | null = null, query = "") =>
  api.request(`/videos/${videoId}/comments${query}`, { headers: who?.bearer });
const replies = (videoId: string, commentId: string, who: Who | null = null) =>
  api.request(`/videos/${videoId}/comments/${commentId}/replies`, { headers: who?.bearer });
const watchedCount = async (videoId: string) =>
  (await (await api.request(`/videos/${videoId}/watch`)).json()).video.comments;

describe("writing a Comment", () => {
  it("lets a signed-in User comment, and shows the author, the owner flag and a Reply count", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada);

    const response = await write(id, grace, { body: "  Lovely trip  " });
    expect(response.status).toBe(201);
    const { comment } = await response.json();
    expect(comment).toMatchObject({
      body: "Lovely trip",
      authorName: "Grace-Hopper",
      isChannelOwner: false,
      replyCount: 0,
    });

    const owner = await (await write(id, ada, { body: "Thanks!" })).json();
    expect(owner.comment.isChannelOwner).toBe(true);
  });

  it("refuses an anonymous caller", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada);
    expect((await write(id, null, { body: "hi" })).status).toBe(401);
    expect(await prisma.comment.count()).toBe(0);
  });

  it("refuses a blank, over-long or non-text body", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada);
    for (const body of ["", "   \n ", "x".repeat(1001), 5, undefined]) {
      expect((await write(id, ada, { body })).status).toBe(400);
    }
    expect((await write(id, ada, { body: "x".repeat(1000) })).status).toBe(201);
  });

  it("keeps markup as text", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada);
    const { comment } = await (await write(id, ada, { body: "<b>hi</b> https://example.com" })).json();
    expect(comment.body).toBe("<b>hi</b> https://example.com");
  });

  it("is only for a Video the person can watch, once it is ready", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const priv = await video(ada, { visibility: "PRIVATE" });
    const deleted = await video(ada, { deletedAt: new Date() });
    const processing = await video(ada, { status: "PROCESSING" });

    expect((await write(priv, grace, { body: "hi" })).status).toBe(404);
    expect((await write(priv, ada, { body: "mine" })).status).toBe(201);
    expect((await write(deleted, ada, { body: "hi" })).status).toBe(404);
    expect((await write("missing", ada, { body: "hi" })).status).toBe(404);
    expect((await write(processing, ada, { body: "hi" })).status).toBe(409);
  });
});

describe("Replies", () => {
  it("attaches a Reply to a Reply to the top-level Comment", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada);
    const top = (await (await write(id, grace, { body: "First" })).json()).comment;
    const reply = (await (await write(id, ada, { body: "Reply", parentId: top.id })).json()).comment;
    const deeper = (await (await write(id, grace, { body: "Deeper", parentId: reply.id })).json()).comment;

    expect(reply.parentId).toBe(top.id);
    expect(deeper.parentId).toBe(top.id);

    const shown = await (await replies(id, top.id)).json();
    expect(shown.replies.map((r: { body: string }) => r.body)).toEqual(["Reply", "Deeper"]);
    const topLevel = await (await list(id)).json();
    expect(topLevel.comments).toHaveLength(1);
    expect(topLevel.comments[0].replyCount).toBe(2);
  });

  it("refuses a target that is missing, deleted, hidden or on another Video", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada);
    const other = await video(ada);
    const make = async (videoId: string, data: object = {}) =>
      (await prisma.comment.create({ data: { videoId, authorId: ada.user.id, body: "x", ...data } })).id;

    const deleted = await make(id, { deletedAt: new Date() });
    const hidden = await make(id, { hiddenAt: new Date() });
    const elsewhere = await make(other);
    const top = await make(id, { hiddenAt: new Date() });
    const underHidden = await make(id, { parentId: top });

    for (const parentId of ["missing", deleted, hidden, elsewhere, underHidden]) {
      expect((await write(id, ada, { body: "hi", parentId })).status).toBe(409);
    }
    expect((await write(id, ada, { body: "hi", parentId: 5 })).status).toBe(400);
  });

  it("is refused on a Video that is not ready", async () => {
    const ada = await person("Ada-Lovelace");
    const processing = await video(ada, { status: "PROCESSING" });
    expect((await replies(processing, "any")).status).toBe(409);
  });
});

describe("reading Comments", () => {
  it("lists top-level Comments newest first, 20 a page, with hasMore", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada);
    const start = Date.now() - 100_000;
    await prisma.comment.createMany({
      data: Array.from({ length: 25 }, (_, n) => ({
        videoId: id,
        authorId: ada.user.id,
        body: `c${n}`,
        createdAt: new Date(start + n * 1000),
      })),
    });

    const first = await (await list(id)).json();
    expect(first.comments).toHaveLength(20);
    expect(first.comments[0].body).toBe("c24");
    expect(first).toMatchObject({ page: 1, hasMore: true });

    const second = await (await list(id, null, "?page=2")).json();
    expect(second.comments.map((c: { body: string }) => c.body)).toEqual(["c4", "c3", "c2", "c1", "c0"]);
    expect(second).toMatchObject({ page: 2, hasMore: false });

    expect((await (await list(id, null, "?page=abc")).json()).page).toBe(1);
  });

  it("is open to anonymous Viewers of a public Video, and only the owner on a private one", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada, { visibility: "PRIVATE" });
    await write(id, ada, { body: "note to self" });

    expect((await list(id)).status).toBe(404);
    expect((await list(id, grace)).status).toBe(404);
    expect((await (await list(id, ada)).json()).comments).toHaveLength(1);
    expect((await replies(id, "any")).status).toBe(404);

    const open = await video(ada);
    await write(open, grace, { body: "hello" });
    expect((await (await list(open)).json()).comments).toHaveLength(1);
  });

  it("shows nothing for a deleted or unready Video", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada);
    await write(id, ada, { body: "hello" });
    await prisma.video.update({ where: { id }, data: { deletedAt: new Date() } });
    expect((await list(id, ada)).status).toBe(404);

    const processing = await video(ada, { status: "PROCESSING" });
    expect((await list(processing, ada)).status).toBe(409);
  });

  it("leaves out deleted and hidden Comments, and counts visible ones on the watch response", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada);
    expect(await watchedCount(id)).toBe(0);

    const top = (await (await write(id, ada, { body: "top" })).json()).comment;
    await write(id, ada, { body: "reply", parentId: top.id });
    await write(id, ada, { body: "second top" });
    expect(await watchedCount(id)).toBe(3);

    await prisma.comment.updateMany({ where: { body: "second top" }, data: { hiddenAt: new Date() } });
    await prisma.comment.updateMany({ where: { body: "reply" }, data: { deletedAt: new Date() } });
    expect(await watchedCount(id)).toBe(1);
    const shown = await (await list(id)).json();
    expect(shown.comments).toHaveLength(1);
    expect(shown.comments[0].replyCount).toBe(0);
  });
});

describe("request events", () => {
  it("record the Video and Comment, never the text", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada);
    const top = (await (await write(id, ada, { body: "secret words" })).json()).comment;
    await write(id, ada, { body: "more secret words", parentId: top.id });
    await list(id);
    await replies(id, top.id);
    await settle();

    const found = events.filter((e) => e.commentAction);
    expect(found.map((e) => e.commentAction)).toEqual(["create", "create", "list", "replies"]);
    expect(found[0]).toMatchObject({ videoId: id, commentId: top.id, route: "/api/v1/videos/:id/comments" });
    expect(found[1]).toMatchObject({ commentParentId: top.id });
    expect(found[3]).toMatchObject({ commentParentId: top.id, commentCount: 1 });
    expect(JSON.stringify(events)).not.toContain("secret words");
  });
});
