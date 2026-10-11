import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.ts";
import { setEmit, type WideEvent } from "../lib/wide-event.ts";
import { UserRepository } from "../repositories/users.repository.ts";
import { resetDatabase, startTestApi } from "../test/helpers.ts";
import { signToken } from "../utils/jwt.ts";

let api: Awaited<ReturnType<typeof startTestApi>>;
beforeAll(async () => {
  api = await startTestApi();
});
afterAll(async () => {
  await api.close();
});
let events: WideEvent[];
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

async function video(owner: Who, data: Record<string, unknown> = {}) {
  const channel = await prisma.channel.findUniqueOrThrow({ where: { userId: owner.user.id } });
  return (
    await prisma.video.create({
      data: {
        channelId: channel.id,
        title: "Holiday",
        description: "Two weeks away",
        status: "READY",
        visibility: "PUBLIC",
        ...data,
      },
    })
  ).id;
}

async function comment(videoId: string, author: Who, data: Record<string, unknown> = {}) {
  return (
    await prisma.comment.create({ data: { videoId, authorId: author.user.id, body: "Lovely", ...data } })
  ).id;
}

const react = (videoId: string, commentId: string, who: Who, kind: unknown) =>
  api.request(`/videos/${videoId}/comments/${commentId}/reaction`, {
    method: "PUT",
    json: { kind },
    headers: who.bearer,
  });
const unreact = (videoId: string, commentId: string, who: Who) =>
  api.request(`/videos/${videoId}/comments/${commentId}/reaction`, { method: "DELETE", headers: who.bearer });
const list = async (videoId: string, headers: Record<string, string> = {}) =>
  (await (await api.request(`/videos/${videoId}/comments`, { headers })).json()).comments;

describe("Reacting to a Comment", () => {
  it("lets a signed-in User Like a Comment and a Reply, switch, and remove", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const v = await video(ada);
    const c = await comment(v, ada);
    const r = await comment(v, ada, { parentId: c });

    const liked = await react(v, c, grace, "LIKE");
    const reply = await react(v, r, grace, "LIKE");
    const switched = await react(v, c, grace, "DISLIKE");
    const removed = await unreact(v, c, grace);

    expect(liked.status).toBe(200);
    expect(await liked.json()).toEqual({ likes: 1, myReaction: "LIKE" });
    expect(await reply.json()).toEqual({ likes: 1, myReaction: "LIKE" });
    expect(await switched.json()).toEqual({ likes: 0, myReaction: "DISLIKE" });
    expect(await removed.json()).toEqual({ likes: 0, myReaction: null });
  });

  it("is idempotent for PUT and DELETE", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const v = await video(ada);
    const c = await comment(v, ada);

    await react(v, c, grace, "LIKE");
    const again = await react(v, c, grace, "LIKE");
    await unreact(v, c, grace);
    const gone = await unreact(v, c, grace);

    expect(await again.json()).toEqual({ likes: 1, myReaction: "LIKE" });
    expect(gone.status).toBe(200);
    expect(await gone.json()).toEqual({ likes: 0, myReaction: null });
    expect(await prisma.reaction.count()).toBe(0);
  });

  it("refuses an anonymous caller with 401 and a bad kind with 400", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const v = await video(ada);
    const c = await comment(v, ada);

    const put = await api.request(`/videos/${v}/comments/${c}/reaction`, { method: "PUT", json: { kind: "LIKE" } });
    const del = await api.request(`/videos/${v}/comments/${c}/reaction`, { method: "DELETE" });

    expect(put.status).toBe(401);
    expect(del.status).toBe(401);
    for (const kind of ["LOVE", "like", undefined, null]) {
      expect((await react(v, c, grace, kind)).status).toBe(400);
    }
  });

  it("tells only the Video's owner the Dislikes, not the Comment's author", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const alan = await person("Alan-Turing");
    const v = await video(ada);
    const c = await comment(v, grace);

    await react(v, c, alan, "DISLIKE");
    const author = await react(v, c, grace, "LIKE");
    const owner = await react(v, c, ada, "LIKE");

    expect(await author.json()).toEqual({ likes: 1, myReaction: "LIKE" });
    expect(await owner.json()).toEqual({ likes: 2, dislikes: 1, myReaction: "LIKE" });
  });

  it("applies the Video rules: 404 for missing, deleted or someone else's private; 409 for not ready", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const secret = await video(ada, { visibility: "PRIVATE" });
    const secretComment = await comment(secret, ada);
    const gone = await video(ada, { deletedAt: new Date() });
    const goneComment = await comment(gone, ada);
    const processing = await video(ada, { status: "PROCESSING" });
    const processingComment = await comment(processing, ada);

    expect((await react(secret, secretComment, grace, "LIKE")).status).toBe(404);
    expect((await react(secret, secretComment, ada, "LIKE")).status).toBe(200);
    expect((await react(gone, goneComment, grace, "LIKE")).status).toBe(404);
    expect((await react("00000000-0000-0000-0000-000000000000", secretComment, grace, "LIKE")).status).toBe(404);
    expect((await react(processing, processingComment, grace, "LIKE")).status).toBe(409);
    expect((await unreact(processing, processingComment, grace)).status).toBe(409);
  });

  it("is 409 while Comments are off", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const v = await video(ada, { commentsEnabled: false });
    const c = await comment(v, ada);

    expect((await react(v, c, grace, "LIKE")).status).toBe(409);
    expect((await unreact(v, c, grace)).status).toBe(409);
  });

  it("is 404 for a missing Comment, one on another Video, or a deleted Reply", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const v = await video(ada);
    const other = await video(ada);
    const elsewhere = await comment(other, ada);
    const c = await comment(v, ada);
    const deletedReply = await comment(v, ada, { parentId: c, deletedAt: new Date() });
    const deletedAlone = await comment(v, ada, { deletedAt: new Date() });

    expect((await react(v, "00000000-0000-0000-0000-000000000000", grace, "LIKE")).status).toBe(404);
    expect((await react(v, elsewhere, grace, "LIKE")).status).toBe(404);
    expect((await react(v, deletedReply, grace, "LIKE")).status).toBe(404);
    expect((await react(v, deletedAlone, grace, "LIKE")).status).toBe(404);
  });

  it("is 409 for a Hidden Comment (author included), a placeholder, and Replies under a hidden or deleted parent", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const v = await video(ada);
    const hidden = await comment(v, grace, { hiddenAt: new Date() });
    const hiddenReply = await comment(v, grace, { parentId: await comment(v, ada), hiddenAt: new Date() });
    const placeholder = await comment(v, ada, { deletedAt: new Date() });
    const survivor = await comment(v, grace, { parentId: placeholder });
    const parentHidden = await comment(v, ada, { hiddenAt: new Date() });
    const underHidden = await comment(v, ada, { parentId: parentHidden });

    for (const target of [hidden, hiddenReply, placeholder, survivor, underHidden]) {
      expect((await react(v, target, grace, "LIKE")).status).toBe(409);
      expect((await react(v, target, ada, "LIKE")).status).toBe(409);
    }
  });

  it("carries likes and myReaction on listed Comments and Replies, dislikes only for the owner", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const alan = await person("Alan-Turing");
    const v = await video(ada);
    const c = await comment(v, grace);
    const quiet = await comment(v, grace, { createdAt: new Date(Date.now() - 5000) });
    const r = await comment(v, alan, { parentId: c });
    await react(v, c, grace, "LIKE");
    await react(v, c, alan, "DISLIKE");
    await react(v, r, grace, "LIKE");

    const anonymous = await list(v);
    expect(anonymous[0]).toMatchObject({ id: c, likes: 1, myReaction: null });
    expect(anonymous[0]).not.toHaveProperty("dislikes");
    expect(anonymous[1]).toMatchObject({ id: quiet, likes: 0, myReaction: null });
    expect((await list(v, grace.bearer))[0]).toMatchObject({ likes: 1, myReaction: "LIKE" });
    expect((await list(v, alan.bearer))[0]).toMatchObject({ likes: 1, myReaction: "DISLIKE" });
    expect((await list(v, ada.bearer))[0]).toMatchObject({ likes: 1, dislikes: 1, myReaction: null });
    expect((await list(v, ada.bearer))[1]).toMatchObject({ likes: 0, dislikes: 0 });

    const replies = await (await api.request(`/videos/${v}/comments/${c}/replies`, { headers: ada.bearer })).json();
    expect(replies.replies[0]).toMatchObject({ id: r, likes: 1, dislikes: 0, myReaction: null });
  });

  it("carries the counts on a Comment just written and just edited", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const v = await video(ada);
    const created = await api.request(`/videos/${v}/comments`, { method: "POST", json: { body: "Hi" }, headers: grace.bearer });
    const { comment: made } = await created.json();
    expect(made).toMatchObject({ likes: 0, myReaction: null });

    await react(v, made.id, ada, "LIKE");
    const edited = await api.request(`/videos/${v}/comments/${made.id}`, {
      method: "PATCH",
      json: { body: "Hi again" },
      headers: grace.bearer,
    });
    expect((await edited.json()).comment).toMatchObject({ likes: 1, edited: true });
  });

  it("keeps Reactions through an edit, and through hide then unhide", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const alan = await person("Alan-Turing");
    const v = await video(ada);
    const c = await comment(v, grace);
    await react(v, c, alan, "LIKE");

    await api.request(`/videos/${v}/comments/${c}`, { method: "PATCH", json: { body: "Better" }, headers: grace.bearer });
    expect((await list(v))[0]).toMatchObject({ likes: 1 });

    await api.request(`/videos/${v}/comments/${c}/hide`, { method: "POST", headers: ada.bearer });
    expect(await list(v)).toEqual([]);
    expect(await prisma.reaction.count({ where: { commentId: c } })).toBe(1);

    await api.request(`/videos/${v}/comments/${c}/unhide`, { method: "POST", headers: ada.bearer });
    expect((await list(v))[0]).toMatchObject({ likes: 1 });
    expect((await list(v, alan.bearer))[0]).toMatchObject({ myReaction: "LIKE" });
  });

  it("shows counts on the owner's hidden list", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const v = await video(ada);
    const c = await comment(v, grace, { hiddenAt: new Date() });
    await prisma.reaction.create({ data: { userId: grace.user.id, commentId: c, kind: "DISLIKE" } });

    const res = await api.request(`/videos/${v}/comments/hidden`, { headers: ada.bearer });

    expect((await res.json()).comments[0]).toMatchObject({ id: c, likes: 0, dislikes: 1 });
  });

  it("does not disturb Video Reactions by the same User", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const v = await video(ada);
    const c = await comment(v, ada);

    await api.request(`/videos/${v}/reaction`, { method: "PUT", json: { kind: "LIKE" }, headers: grace.bearer });
    await react(v, c, grace, "DISLIKE");

    const watch = await (await api.request(`/videos/${v}/watch`, { headers: grace.bearer })).json();
    expect(watch.video).toMatchObject({ likes: 1, myReaction: "LIKE" });
    expect((await list(v, grace.bearer))[0]).toMatchObject({ likes: 0, myReaction: "DISLIKE" });
  });

  describe("rate limit", () => {
    // The User's `count` Video Reactions, `secondsAgo` old.
    async function seed(who: Who, count: number, secondsAgo: number) {
      const ada = await person("Ada-Lovelace");
      const at = new Date(Date.now() - secondsAgo * 1000);
      for (let n = 0; n < count; n++) {
        await prisma.reaction.create({
          data: { userId: who.user.id, videoId: await video(ada), kind: "LIKE", createdAt: at, updatedAt: at },
        });
      }
      const v = await video(ada);
      return { v, c: await comment(v, ada) };
    }

    it("counts Video Reactions toward the limit on Comments", async () => {
      const grace = await person("Grace-Hopper");
      const { v, c } = await seed(grace, 30, 5);

      const refused = await react(v, c, grace, "LIKE");

      expect(refused.status).toBe(429);
      expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
    });

    it("counts Comment Reactions toward the limit on Videos", async () => {
      const grace = await person("Grace-Hopper");
      const ada = await person("Ada-Lovelace");
      const v = await video(ada);
      const at = new Date(Date.now() - 5000);
      for (let n = 0; n < 30; n++) {
        await prisma.reaction.create({
          data: { userId: grace.user.id, commentId: await comment(v, ada), kind: "LIKE", createdAt: at, updatedAt: at },
        });
      }

      const res = await api.request(`/videos/${v}/reaction`, { method: "PUT", json: { kind: "LIKE" }, headers: grace.bearer });

      expect(res.status).toBe(429);
    });

    it("lets the User react again once the window has passed", async () => {
      const grace = await person("Grace-Hopper");
      const { v, c } = await seed(grace, 30, 61);

      expect((await react(v, c, grace, "LIKE")).status).toBe(200);
    });
  });

  describe("wide event", () => {
    it("records the Reaction fields and the Comment id, not who", async () => {
      const ada = await person("Ada-Lovelace");
      const grace = await person("Grace-Hopper");
      const v = await video(ada);
      const c = await comment(v, ada);

      await react(v, c, grace, "LIKE");
      await react(v, c, grace, "DISLIKE");
      await unreact(v, c, grace);
      await settle();

      const reactions = events.filter((e) => e.reactionAction !== undefined);
      expect(reactions).toHaveLength(3);
      expect(reactions[0]).toMatchObject({ reactionAction: "set", reactionKind: "LIKE", reactionFrom: null, commentId: c, videoId: v });
      expect(reactions[1]).toMatchObject({ reactionKind: "DISLIKE", reactionFrom: "LIKE" });
      expect(reactions[2]).toMatchObject({ reactionAction: "remove", reactionFrom: "DISLIKE", commentId: c });
    });
  });
});
