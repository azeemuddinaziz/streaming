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
  return { user, channelId: user.channel!.id, bearer: { Authorization: `Bearer ${await signToken(user.id)}` } };
}
type Who = Awaited<ReturnType<typeof person>>;

// Subscribes directly, with a creation time `minutesAgo` in the past, so order is deterministic.
const subscribeAt = (who: Who, to: Who, minutesAgo = 0) =>
  prisma.subscription.create({
    data: { userId: who.user.id, channelId: to.channelId, createdAt: new Date(Date.now() - minutesAgo * 60_000) },
  });

const list = (who?: Who, query = "") =>
  api.request(`/users/me/subscriptions${query}`, { headers: who?.bearer });

describe("Listing subscribed Channels", () => {
  it("is 401 for anonymous callers", async () => {
    expect((await list()).status).toBe(401);
  });

  it("lists the caller's Channels, most recently subscribed first, with counts", async () => {
    const grace = await person("Grace-Hopper");
    const ada = await person("Ada-Lovelace");
    const alan = await person("Alan-Turing");
    const edsger = await person("Edsger-Dijkstra");
    await subscribeAt(grace, ada, 30);
    await subscribeAt(grace, alan, 10);
    await subscribeAt(edsger, alan, 5);

    const res = await list(grace);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      channels: [
        { name: "Alan-Turing", subscribers: 2, subscribed: true },
        { name: "Ada-Lovelace", subscribers: 1, subscribed: true },
      ],
      page: 1,
      hasMore: false,
    });
  });

  it("shows only the caller's own Subscriptions, and no Video data", async () => {
    const grace = await person("Grace-Hopper");
    const ada = await person("Ada-Lovelace");
    const alan = await person("Alan-Turing");
    await subscribeAt(alan, ada);

    expect((await (await list(grace)).json()).channels).toEqual([]);

    await subscribeAt(grace, ada);
    const entry = (await (await list(grace)).json()).channels[0];
    expect(Object.keys(entry).sort()).toEqual(["name", "subscribed", "subscribers"]);
  });

  it("drops a Channel from the list once unsubscribed", async () => {
    const grace = await person("Grace-Hopper");
    const ada = await person("Ada-Lovelace");
    await subscribeAt(grace, ada);

    await api.request("/channels/Ada-Lovelace/subscription", { method: "DELETE", headers: grace.bearer });

    expect((await (await list(grace)).json()).channels).toEqual([]);
  });

  it("pages 24 at a time with hasMore, and treats a bad page as 1", async () => {
    const grace = await person("Grace-Hopper");
    for (let i = 0; i < 25; i++) await subscribeAt(grace, await person(`Creator-${i}`), 100 - i);

    const first = await (await list(grace)).json();
    expect(first.channels).toHaveLength(24);
    expect(first).toMatchObject({ page: 1, hasMore: true });
    expect(first.channels[0].name).toBe("Creator-24");

    const second = await (await list(grace, "?page=2")).json();
    expect(second.channels.map((c: { name: string }) => c.name)).toEqual(["Creator-0"]);
    expect(second).toMatchObject({ page: 2, hasMore: false });

    expect((await (await list(grace, "?page=abc")).json()).page).toBe(1);
    expect((await (await list(grace, "?page=0")).json()).page).toBe(1);
  });

  it("records the action and the number of entries on the wide event", async () => {
    const grace = await person("Grace-Hopper");
    await subscribeAt(grace, await person("Ada-Lovelace"));

    await list(grace);
    await settle();

    const event = events.find((e) => String(e.route).endsWith("/me/subscriptions"));
    expect(event).toMatchObject({ subscriptionAction: "list", subscriptionCount: 1 });
  });
});
