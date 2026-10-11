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

const subscribe = (name: string, who?: Who) =>
  api.request(`/channels/${name}/subscription`, { method: "PUT", headers: who?.bearer });
const unsubscribe = (name: string, who?: Who) =>
  api.request(`/channels/${name}/subscription`, { method: "DELETE", headers: who?.bearer });

describe("Subscribing to a Channel", () => {
  it("subscribes a signed-in User and answers the current state", async () => {
    await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");

    const res = await subscribe("Ada-Lovelace", grace);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ subscribed: true, subscribers: 1 });
  });

  it("is idempotent in both directions", async () => {
    await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");

    await subscribe("Ada-Lovelace", grace);
    expect(await (await subscribe("Ada-Lovelace", grace)).json()).toEqual({ subscribed: true, subscribers: 1 });

    expect(await (await unsubscribe("Ada-Lovelace", grace)).json()).toEqual({ subscribed: false, subscribers: 0 });
    expect(await (await unsubscribe("Ada-Lovelace", grace)).json()).toEqual({ subscribed: false, subscribers: 0 });
    expect(await prisma.subscription.count()).toBe(0);
  });

  it("matches the name regardless of case", async () => {
    await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");

    expect((await subscribe("ADA-lovelace", grace)).status).toBe(200);
  });

  it("is 401 for anonymous callers and 404 for an unknown Channel", async () => {
    await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");

    expect((await subscribe("Ada-Lovelace")).status).toBe(401);
    expect((await unsubscribe("Ada-Lovelace")).status).toBe(401);
    expect((await subscribe("nobody", grace)).status).toBe(404);
    expect((await unsubscribe("nobody", grace)).status).toBe(404);
  });

  it("refuses subscribing to your own Channel with 409, while unsubscribing is a no-op", async () => {
    const ada = await person("Ada-Lovelace");

    expect((await subscribe("ada-lovelace", ada)).status).toBe(409);
    const res = await unsubscribe("ada-lovelace", ada);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ subscribed: false, subscribers: 0 });
  });

  it("subscribes to a Channel that has no public Videos", async () => {
    await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");

    expect((await subscribe("Ada-Lovelace", grace)).status).toBe(200);
  });
});

describe("Subscriber counts on Channel and watch responses", () => {
  it("carries subscribers and subscribed, null when signed out", async () => {
    await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const alan = await person("Alan-Turing");
    await subscribe("Ada-Lovelace", grace);

    const anon = await (await api.request("/channels/Ada-Lovelace")).json();
    expect(anon).toMatchObject({ subscribers: 1, subscribed: null });
    const mine = await (await api.request("/channels/Ada-Lovelace", { headers: grace.bearer })).json();
    expect(mine).toMatchObject({ subscribers: 1, subscribed: true });
    const other = await (await api.request("/channels/Ada-Lovelace", { headers: alan.bearer })).json();
    expect(other).toMatchObject({ subscribers: 1, subscribed: false });
  });

  it("carries the same on the watch response", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada);
    await subscribe("Ada-Lovelace", grace);

    const anon = (await (await api.request(`/videos/${id}/watch`)).json()).video;
    expect(anon).toMatchObject({ subscribers: 1, subscribed: null });
    const mine = (await (await api.request(`/videos/${id}/watch`, { headers: grace.bearer })).json()).video;
    expect(mine).toMatchObject({ subscribers: 1, subscribed: true });
    const owner = (await (await api.request(`/videos/${id}/watch`, { headers: ada.bearer })).json()).video;
    expect(owner).toMatchObject({ subscribers: 1, subscribed: false });
  });

  it("never reveals who the Subscribers are", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada);
    await subscribe("Ada-Lovelace", grace);

    for (const res of [
      await api.request("/channels/Ada-Lovelace", { headers: ada.bearer }),
      await api.request(`/videos/${id}/watch`, { headers: ada.bearer }),
      await subscribe("Ada-Lovelace", grace),
    ]) {
      const text = JSON.stringify(await res.json());
      expect(text).not.toContain(grace.user.id);
      expect(text).not.toContain("Grace-Hopper");
    }
  });
});

describe("Subscription write limit", () => {
  it("refuses the 31st subscribe inside a minute with 429 and Retry-After", async () => {
    const grace = await person("Grace-Hopper");
    for (let i = 0; i < 31; i++) await person(`Creator-${i}`);

    for (let i = 0; i < 30; i++) expect((await subscribe(`Creator-${i}`, grace)).status).toBe(200);
    const res = await subscribe("Creator-30", grace);

    expect(res.status).toBe(429);
    const wait = Number(res.headers.get("Retry-After"));
    expect(wait).toBeGreaterThanOrEqual(1);
    expect(wait).toBeLessThanOrEqual(60);
    await settle();
    expect(events.at(-1)).toMatchObject({ rateLimited: true });
  });

  it("does not count removals, nor another User's subscribes", async () => {
    const grace = await person("Grace-Hopper");
    const alan = await person("Alan-Turing");
    for (let i = 0; i < 31; i++) await person(`Creator-${i}`);

    for (let i = 0; i < 30; i++) await subscribe(`Creator-${i}`, grace);
    expect((await subscribe("Creator-0", alan)).status).toBe(200);
    await unsubscribe("Creator-0", grace);

    expect((await subscribe("Creator-30", grace)).status).toBe(200);
  });
});

describe("Subscription wide event", () => {
  it("records the action, the Channel subscribed to and the previous state", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const channel = await prisma.channel.findUniqueOrThrow({ where: { userId: ada.user.id } });

    await subscribe("Ada-Lovelace", grace);
    await unsubscribe("Ada-Lovelace", grace);
    await settle();

    const [sub, unsub] = events.filter((e) => String(e.route).endsWith("/subscription"));
    expect(sub).toMatchObject({
      subscriptionAction: "subscribe",
      subscribedChannelId: channel.id,
      subscriptionFrom: false,
    });
    expect(unsub).toMatchObject({
      subscriptionAction: "unsubscribe",
      subscribedChannelId: channel.id,
      subscriptionFrom: true,
    });
    expect(sub!.channelId).not.toBe(channel.id);
  });
});
