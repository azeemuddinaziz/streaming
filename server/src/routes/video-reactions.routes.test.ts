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

const react = (videoId: string, who: Who, kind: unknown) =>
  api.request(`/videos/${videoId}/reaction`, { method: "PUT", json: { kind }, headers: who.bearer });
const unreact = (videoId: string, who: Who) =>
  api.request(`/videos/${videoId}/reaction`, { method: "DELETE", headers: who.bearer });

describe("Reacting to a Video", () => {
  it("lets a signed-in User Like a Video and returns the Like count and their Reaction", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada);

    const res = await react(id, grace, "LIKE");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ likes: 1, myReaction: "LIKE" });
  });

  it("replaces a Like with a Dislike, and counting leaves only one Reaction per User", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada);

    await react(id, grace, "LIKE");
    const res = await react(id, grace, "DISLIKE");

    expect(await res.json()).toEqual({ likes: 0, myReaction: "DISLIKE" });
  });

  it("is idempotent: repeating the same kind changes nothing", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada);

    await react(id, grace, "LIKE");
    const again = await react(id, grace, "LIKE");

    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ likes: 1, myReaction: "LIKE" });
  });

  it("counts each User's Like once", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const alan = await person("Alan-Turing");
    const id = await video(ada);

    await react(id, grace, "LIKE");
    const res = await react(id, alan, "LIKE");

    expect(await res.json()).toEqual({ likes: 2, myReaction: "LIKE" });
  });

  it("removes a Reaction with DELETE, and removing none still succeeds", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada);

    await react(id, grace, "LIKE");
    const removed = await unreact(id, grace);
    const again = await unreact(id, grace);

    expect(removed.status).toBe(200);
    expect(await removed.json()).toEqual({ likes: 0, myReaction: null });
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ likes: 0, myReaction: null });
  });

  it("refuses an anonymous caller with 401", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada);

    const res = await api.request(`/videos/${id}/reaction`, { method: "PUT", json: { kind: "LIKE" } });
    const removal = await api.request(`/videos/${id}/reaction`, { method: "DELETE" });

    expect(res.status).toBe(401);
    expect(removal.status).toBe(401);
  });

  it("refuses a kind that is not LIKE or DISLIKE with 400", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada);

    for (const kind of ["LOVE", "like", undefined, null, 1]) {
      expect((await react(id, grace, kind)).status).toBe(400);
    }
  });

  it("tells only the owner how many Dislikes a Video has", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const alan = await person("Alan-Turing");
    const id = await video(ada);

    await react(id, grace, "DISLIKE");
    const owner = await react(id, ada, "LIKE");
    const other = await react(id, alan, "LIKE");

    expect(await owner.json()).toEqual({ likes: 1, dislikes: 1, myReaction: "LIKE" });
    expect(await other.json()).toEqual({ likes: 2, myReaction: "LIKE" });
  });

  it("applies to an unlisted Video, and a private one only for its owner", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const unlisted = await video(ada, { visibility: "UNLISTED" });
    const secret = await video(ada, { visibility: "PRIVATE" });

    expect((await react(unlisted, grace, "LIKE")).status).toBe(200);
    expect((await react(secret, grace, "LIKE")).status).toBe(404);
    expect((await unreact(secret, grace)).status).toBe(404);
    expect((await react(secret, ada, "LIKE")).status).toBe(200);
  });

  it("is 404 for a missing or deleted Video and 409 for one that is not ready", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const gone = await video(ada, { deletedAt: new Date() });
    const processing = await video(ada, { status: "PROCESSING" });

    expect((await react("00000000-0000-0000-0000-000000000000", grace, "LIKE")).status).toBe(404);
    expect((await react(gone, grace, "LIKE")).status).toBe(404);
    expect((await react(processing, grace, "LIKE")).status).toBe(409);
    expect((await unreact(processing, grace)).status).toBe(409);
  });

  it("shows the watch page the Like count, and each person their own Reaction", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const alan = await person("Alan-Turing");
    const id = await video(ada);
    await react(id, grace, "LIKE");
    await react(id, alan, "DISLIKE");

    const watch = async (headers: Record<string, string> = {}) =>
      (await (await api.request(`/videos/${id}/watch`, { headers })).json()).video;

    const anonymous = await watch();
    expect(anonymous).toMatchObject({ likes: 1, myReaction: null });
    expect(anonymous).not.toHaveProperty("dislikes");
    expect(await watch(grace.bearer)).toMatchObject({ likes: 1, myReaction: "LIKE" });
    expect(await watch(alan.bearer)).toMatchObject({ likes: 1, myReaction: "DISLIKE" });
    const owner = await watch(ada.bearer);
    expect(owner).toMatchObject({ likes: 1, dislikes: 1, myReaction: null });
  });

  it("gives the owner both counts for each Video in the studio list", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const alan = await person("Alan-Turing");
    const id = await video(ada);
    await react(id, grace, "LIKE");
    await react(id, alan, "DISLIKE");

    const res = await api.request("/videos/mine", { headers: ada.bearer });
    const { videos } = await res.json();

    expect(videos).toHaveLength(1);
    expect(videos[0]).toMatchObject({ likes: 1, dislikes: 1 });
  });

  describe("rate limit", () => {
    // Puts `count` Reactions by the User on other Videos, `secondsAgo` old.
    async function seed(who: Who, count: number, secondsAgo: number) {
      const ada = await person("Ada-Lovelace");
      for (let n = 0; n < count; n++) {
        const id = await video(ada);
        await prisma.reaction.create({
          data: {
            userId: who.user.id,
            videoId: id,
            kind: "LIKE",
            createdAt: new Date(Date.now() - secondsAgo * 1000),
            updatedAt: new Date(Date.now() - secondsAgo * 1000),
          },
        });
      }
      return await video(ada);
    }

    it("refuses the 31st Reaction change inside a minute with 429 and Retry-After", async () => {
      const grace = await person("Grace-Hopper");
      const target = await seed(grace, 30, 5);

      const refused = await react(target, grace, "LIKE");

      expect(refused.status).toBe(429);
      const wait = Number(refused.headers.get("Retry-After"));
      expect(wait).toBeGreaterThanOrEqual(1);
      expect(wait).toBeLessThanOrEqual(60);
      expect((await refused.json()).msg).toMatch(/slow down/i);
    });

    it("lets the User react again once the window has passed", async () => {
      const grace = await person("Grace-Hopper");
      const target = await seed(grace, 30, 61);

      expect((await react(target, grace, "LIKE")).status).toBe(200);
    });

    it("counts only the person's own Reactions", async () => {
      const grace = await person("Grace-Hopper");
      const alan = await person("Alan-Turing");
      const target = await seed(grace, 30, 5);

      expect((await react(target, alan, "LIKE")).status).toBe(200);
    });
  });

  describe("wide event", () => {
    it("records what changed, never who", async () => {
      const ada = await person("Ada-Lovelace");
      const grace = await person("Grace-Hopper");
      const id = await video(ada);

      await react(id, grace, "LIKE");
      await react(id, grace, "DISLIKE");
      await unreact(id, grace);
      await settle();

      const reactions = events.filter((e) => e.reactionAction !== undefined);
      expect(reactions).toHaveLength(3);
      expect(reactions[0]).toMatchObject({ reactionAction: "set", reactionKind: "LIKE", reactionFrom: null, videoId: id });
      expect(reactions[1]).toMatchObject({ reactionAction: "set", reactionKind: "DISLIKE", reactionFrom: "LIKE" });
      expect(reactions[2]).toMatchObject({ reactionAction: "remove", reactionFrom: "DISLIKE" });
      expect(reactions[2]).not.toHaveProperty("reactionKind");
    });

    it("marks a refused write as rate limited", async () => {
      const grace = await person("Grace-Hopper");
      const ada = await person("Ada-Lovelace");
      const target = await video(ada);
      await prisma.reaction.createMany({
        data: await Promise.all(
          Array.from({ length: 30 }, async () => ({ userId: grace.user.id, videoId: await video(ada), kind: "LIKE" as const })),
        ),
      });

      await react(target, grace, "LIKE");
      await settle();

      expect(events.find((e) => e.reactionAction === "set")).toMatchObject({ rateLimited: true, status: 429 });
    });
  });
});
