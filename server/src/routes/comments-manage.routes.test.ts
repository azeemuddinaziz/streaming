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
      data: {
        channelId: channel.id,
        title: "Holiday",
        description: "Two weeks away",
        status: "READY",
        visibility: "PUBLIC",
      },
    })
  ).id;
}

const write = async (videoId: string, who: Who, body: string, parentId?: string) =>
  (await (await api.request(`/videos/${videoId}/comments`, { method: "POST", json: { body, parentId }, headers: who.bearer })).json())
    .comment;
const edit = (videoId: string, commentId: string, who: Who | null, body: unknown) =>
  api.request(`/videos/${videoId}/comments/${commentId}`, { method: "PATCH", json: { body }, headers: who?.bearer });
const remove = (videoId: string, commentId: string, who: Who | null) =>
  api.request(`/videos/${videoId}/comments/${commentId}`, { method: "DELETE", headers: who?.bearer });
const top = async (videoId: string, who: Who | null = null) =>
  (await (await api.request(`/videos/${videoId}/comments`, { headers: who?.bearer })).json()).comments;
const repliesOf = (videoId: string, commentId: string) =>
  api.request(`/videos/${videoId}/comments/${commentId}/replies`);
const count = async (videoId: string) =>
  (await (await api.request(`/videos/${videoId}/watch`)).json()).video.comments;

describe("editing a Comment", () => {
  it("lets the author change the text, marks it edited and keeps no earlier wording", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada);
    const comment = await write(id, grace, "first draft");
    expect(comment).toMatchObject({ edited: false, isAuthor: true, deleted: false });

    const response = await edit(id, comment.id, grace, "  second draft ");
    expect(response.status).toBe(200);
    expect((await response.json()).comment).toMatchObject({ body: "second draft", edited: true });

    const row = await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } });
    expect(row.body).toBe("second draft");
    expect(row.editedAt).not.toBeNull();
    expect(JSON.stringify(await prisma.comment.findMany())).not.toContain("first draft");

    const listed = await top(id, ada);
    expect(listed[0]).toMatchObject({ edited: true, isAuthor: false });
  });

  it("applies the writing rules to the new text", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada);
    const comment = await write(id, ada, "hello");
    for (const body of ["", "  ", "x".repeat(1001), 5, undefined]) {
      expect((await edit(id, comment.id, ada, body)).status).toBe(400);
    }
    expect((await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } })).editedAt).toBeNull();
  });

  it("is 404 for someone else, a missing or a deleted Comment, and 401 when anonymous", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada);
    const comment = await write(id, grace, "mine");
    const gone = await write(id, grace, "gone");
    await remove(id, gone.id, grace);

    expect((await edit(id, comment.id, ada, "taken over")).status).toBe(404);
    expect((await edit(id, "missing", grace, "x")).status).toBe(404);
    expect((await edit(id, gone.id, grace, "x")).status).toBe(404);
    expect((await edit(id, comment.id, null, "x")).status).toBe(401);
    expect((await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } })).body).toBe("mine");
  });
});

describe("deleting a Comment", () => {
  it("removes a Comment without Replies from the list and the count, and keeps the record", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada);
    const comment = await write(id, ada, "bye");
    expect(await count(id)).toBe(1);

    expect((await remove(id, comment.id, ada)).status).toBe(204);
    expect(await top(id)).toHaveLength(0);
    expect(await count(id)).toBe(0);
    const row = await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } });
    expect(row.deletedAt).not.toBeNull();
    expect(row.body).toBe("bye");
    expect((await remove(id, comment.id, ada)).status).toBe(404);
  });

  it("leaves a placeholder with no author or text when it has Replies, and the Replies stay", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada);
    const parent = await write(id, grace, "parent text");
    const reply = await write(id, ada, "a reply", parent.id);
    expect(await count(id)).toBe(2);

    await remove(id, parent.id, grace);
    const listed = await top(id);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toEqual({
      id: parent.id,
      parentId: null,
      body: null,
      authorName: null,
      isChannelOwner: false,
      isAuthor: false,
      deleted: true,
      edited: false,
      createdAt: parent.createdAt,
      replyCount: 1,
    });
    expect(JSON.stringify(listed)).not.toContain("parent text");

    const shown = await (await repliesOf(id, parent.id)).json();
    expect(shown.replies.map((r: { body: string }) => r.body)).toEqual(["a reply"]);
    expect(await count(id)).toBe(1);

    // A placeholder is closed to new Replies, directly or through one of its Replies.
    const wide = (parentId: string) =>
      api.request(`/videos/${id}/comments`, { method: "POST", json: { body: "x", parentId }, headers: ada.bearer });
    expect((await wide(parent.id)).status).toBe(409);
    expect((await wide(reply.id)).status).toBe(409);
  });

  it("removes a placeholder once its last Reply is deleted", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada);
    const parent = await write(id, ada, "parent");
    const one = await write(id, ada, "one", parent.id);
    const two = await write(id, ada, "two", parent.id);
    await remove(id, parent.id, ada);

    await remove(id, one.id, ada);
    expect(await top(id)).toHaveLength(1);
    await remove(id, two.id, ada);
    expect(await top(id)).toHaveLength(0);
    expect(await count(id)).toBe(0);
    expect((await repliesOf(id, parent.id)).status).toBe(404);
  });

  it("is 404 for someone else's Comment", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada);
    const comment = await write(id, grace, "mine");
    expect((await remove(id, comment.id, ada)).status).toBe(404);
    expect((await remove(id, comment.id, null)).status).toBe(401);
    expect((await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } })).deletedAt).toBeNull();
  });
});

describe("request events", () => {
  it("record the edit and delete, never the text", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada);
    const comment = await write(id, ada, "private words");
    await edit(id, comment.id, ada, "other private words");
    await remove(id, comment.id, ada);
    await settle();

    const found = events.filter((e) => e.commentAction);
    expect(found.map((e) => e.commentAction)).toEqual(["create", "edit", "delete"]);
    expect(found[1]).toMatchObject({ commentId: comment.id, videoId: id, route: "/api/v1/videos/:id/comments/:commentId" });
    expect(found[2]).toMatchObject({ commentId: comment.id });
    expect(JSON.stringify(events)).not.toContain("private words");
  });
});
