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

const setting = (videoId: string, who: Who | null, commentsEnabled: unknown) =>
  api.request(`/videos/${videoId}`, { method: "PATCH", json: { commentsEnabled }, headers: who?.bearer });
const write = (videoId: string, who: Who, body: string, parentId?: string) =>
  api.request(`/videos/${videoId}/comments`, { method: "POST", json: { body, parentId }, headers: who.bearer });
const written = async (videoId: string, who: Who, body: string, parentId?: string) =>
  (await (await write(videoId, who, body, parentId)).json()).comment;
const list = async (videoId: string, who: Who | null = null) =>
  (await (await api.request(`/videos/${videoId}/comments`, { headers: who?.bearer })).json()).comments;
const watched = async (videoId: string, who: Who | null = null) =>
  (await (await api.request(`/videos/${videoId}/watch`, { headers: who?.bearer })).json()).video;

describe("the Comments setting", () => {
  it("is on by default, and only the owner can turn it off and on", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada);
    expect((await watched(id)).commentsEnabled).toBe(true);

    expect((await setting(id, grace, false)).status).toBe(404);
    expect((await setting("missing", ada, false)).status).toBe(404);
    expect((await setting(id, null, false)).status).toBe(401);
    expect((await setting(id, ada, "no")).status).toBe(400);
    expect((await prisma.video.findUniqueOrThrow({ where: { id } })).commentsEnabled).toBe(true);

    const off = await setting(id, ada, false);
    expect(off.status).toBe(200);
    expect((await off.json()).video.commentsEnabled).toBe(false);
    expect((await watched(id)).commentsEnabled).toBe(false);

    const studio = await (await api.request("/videos/mine", { headers: ada.bearer })).json();
    expect(studio.videos[0].commentsEnabled).toBe(false);

    expect((await (await setting(id, ada, true)).json()).video.commentsEnabled).toBe(true);
  });

  it("records the change on the request event, only when it changed", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada);
    await setting(id, ada, false);
    await setting(id, ada, false);
    await api.request(`/videos/${id}`, { method: "PATCH", json: { title: "New" }, headers: ada.bearer });
    await settle();

    const patches = events.filter((e) => e.videoAction === "update");
    expect(patches[0]).toMatchObject({ commentsOffFrom: false, commentsOffTo: true });
    expect(patches[1]).not.toHaveProperty("commentsOffFrom");
    expect(patches[2]).not.toHaveProperty("commentsOffFrom");
  });
});

describe("while Comments are off", () => {
  async function scene() {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada);
    const comment = await written(id, grace, "before");
    const reply = await written(id, ada, "answer", comment.id);
    await setting(id, ada, false);
    return { ada, grace, id, comment, reply };
  }

  it("refuses writing, replying and editing with 409", async () => {
    const { ada, grace, id, comment } = await scene();
    expect((await write(id, grace, "new")).status).toBe(409);
    expect((await write(id, ada, "new")).status).toBe(409);
    expect((await write(id, grace, "reply", comment.id)).status).toBe(409);
    const edit = (who: Who) =>
      api.request(`/videos/${id}/comments/${comment.id}`, { method: "PATCH", json: { body: "x" }, headers: who.bearer });
    expect((await edit(grace)).status).toBe(409);
    expect(await prisma.comment.count()).toBe(2);
    expect((await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } })).body).toBe("before");
  });

  it("shows Viewers an empty list and no count, but keeps and shows everything to the owner", async () => {
    const { ada, grace, id, comment } = await scene();

    expect(await list(id)).toEqual([]);
    expect(await list(id, grace)).toEqual([]);
    const replies = (who: Who | null) =>
      api.request(`/videos/${id}/comments/${comment.id}/replies`, { headers: who?.bearer });
    expect((await (await replies(null)).json()).replies).toEqual([]);
    const anyone = await watched(id);
    expect(anyone).not.toHaveProperty("comments");
    expect(anyone.commentsEnabled).toBe(false);
    expect((await watched(id, grace))).not.toHaveProperty("comments");

    expect((await list(id, ada)).map((c: { body: string }) => c.body)).toEqual(["before"]);
    expect((await (await replies(ada)).json()).replies).toHaveLength(1);
    const owner = await watched(id, ada);
    expect(owner).toMatchObject({ comments: 2, commentsEnabled: false, isOwner: true });
  });

  it("still lets the owner hide and un-hide, and see the hidden list", async () => {
    const { ada, id, comment } = await scene();
    const act = (action: string) =>
      api.request(`/videos/${id}/comments/${comment.id}/${action}`, { method: "POST", headers: ada.bearer });
    expect((await act("hide")).status).toBe(204);
    const hidden = await (await api.request(`/videos/${id}/comments/hidden`, { headers: ada.bearer })).json();
    expect(hidden.total).toBe(1);
    expect((await act("unhide")).status).toBe(204);
  });

  it("restores everything when turned back on", async () => {
    const { ada, grace, id } = await scene();
    await setting(id, ada, true);

    expect((await list(id)).map((c: { body: string }) => c.body)).toEqual(["before"]);
    expect((await watched(id)).comments).toBe(2);
    expect((await write(id, grace, "again")).status).toBe(201);
  });
});
