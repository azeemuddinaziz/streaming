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

const write = (videoId: string, who: Who, body = "hello", parentId?: string) =>
  api.request(`/videos/${videoId}/comments`, { method: "POST", json: { body, parentId }, headers: who.bearer });

// Puts `count` Comments by the author in the table, `secondsAgo` old.
async function seed(videoId: string, who: Who, count: number, secondsAgo: number, extra: object = {}) {
  await prisma.comment.createMany({
    data: Array.from({ length: count }, (_, n) => ({
      videoId,
      authorId: who.user.id,
      body: `old ${n}`,
      createdAt: new Date(Date.now() - secondsAgo * 1000 - n),
      ...extra,
    })),
  });
}

describe("rate limiting writing Comments", () => {
  it("refuses the sixth Comment or Reply inside a minute with 429 and Retry-After", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada);
    const first = await (await write(id, ada, "first")).json();

    for (let n = 0; n < 4; n++) expect((await write(id, ada, `c${n}`, n % 2 ? first.comment.id : undefined)).status).toBe(201);
    const refused = await write(id, ada, "sixth");
    expect(refused.status).toBe(429);
    const wait = Number(refused.headers.get("Retry-After"));
    expect(wait).toBeGreaterThanOrEqual(1);
    expect(wait).toBeLessThanOrEqual(60);
    expect((await refused.json()).msg).toMatch(/slow down/i);
    expect(await prisma.comment.count()).toBe(5);
  });

  it("is per User, per minute, and leaves a User under the limit alone", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada);
    await seed(id, ada, 5, 5);
    expect((await write(id, ada)).status).toBe(429);
    expect((await write(id, grace)).status).toBe(201);

    // A User with fewer than five, or whose Comments are over a minute old, may write.
    const linus = await person("Linus-Torvalds");
    await seed(id, linus, 4, 5);
    expect((await write(id, linus)).status).toBe(201);
    expect((await write(id, linus)).status).toBe(429);
    const old = await person("Old-Timer");
    await seed(id, old, 5, 120);
    expect((await write(id, old)).status).toBe(201);
  });

  it("counts deleted and hidden Comments, on any Video", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const one = await video(ada);
    const two = await video(ada);
    await seed(one, grace, 2, 5, { deletedAt: new Date() });
    await seed(two, grace, 3, 5, { hiddenAt: new Date() });
    expect((await write(one, grace)).status).toBe(429);
  });

  it("tells the caller how long to wait, from the oldest Comment in the window", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada);
    await seed(id, ada, 5, 50);
    const refused = await write(id, ada);
    const wait = Number(refused.headers.get("Retry-After"));
    expect(wait).toBeGreaterThanOrEqual(9);
    expect(wait).toBeLessThanOrEqual(10);
  });

  it("records rateLimited on the refused request's event only", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada);
    await seed(id, ada, 5, 5);
    await write(id, ada);
    await settle();
    const created = events.filter((e) => e.commentAction === "create");
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ status: 429, rateLimited: true });

    const grace = await person("Grace-Hopper");
    await write(id, grace);
    await settle();
    expect(events.filter((e) => e.commentAction === "create")[1]).not.toHaveProperty("rateLimited");
  });
});
