import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.ts";
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
beforeEach(async () => {
  await resetDatabase();
});

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

const view = (id: string, headers: Record<string, string> = {}) =>
  api.request(`/videos/${id}/views`, { method: "POST", headers });
const watched = async (id: string) =>
  (await (await api.request(`/videos/${id}/watch`)).json()).video.views;

describe("counting Views", () => {
  it("counts a signed-in User once per Video per day, and the watch page shows the count", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada);
    expect(await watched(id)).toBe(0);

    expect(await (await view(id, grace.bearer)).json()).toEqual({ counted: true, views: 1 });
    expect(await (await view(id, grace.bearer)).json()).toEqual({ counted: false, views: 1 });
    expect(await watched(id)).toBe(1);
  });

  it("counts the same User again on another day", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada);
    await view(id, grace.bearer);
    await prisma.view.updateMany({ data: { day: "2020-01-01" } });

    expect((await (await view(id, grace.bearer)).json()).views).toBe(2);
  });

  it("counts an anonymous Viewer once per day, tells Viewers apart, and never stores the IP address", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada);

    expect((await (await view(id, { "User-Agent": "A" })).json()).counted).toBe(true);
    expect((await (await view(id, { "User-Agent": "A" })).json()).counted).toBe(false);
    expect((await (await view(id, { "User-Agent": "B" })).json()).counted).toBe(true);

    const rows = await prisma.view.findMany();
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.viewerKey).toMatch(/^anon:[0-9a-f]{64}$/);
      expect(JSON.stringify(row)).not.toContain("127.0.0.1");
    }
  });

  it("does not count the owner's own watching", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada, { visibility: "PRIVATE" });

    expect(await (await view(id, ada.bearer)).json()).toEqual({ counted: false, views: 0 });
    expect(await prisma.view.count()).toBe(0);
  });

  it("does not count a Video the Viewer cannot watch", async () => {
    const ada = await person("Ada-Lovelace");
    const priv = await video(ada, { visibility: "PRIVATE" });
    const deleted = await video(ada, { deletedAt: new Date() });
    const processing = await video(ada, { status: "PROCESSING" });

    expect((await view(priv)).status).toBe(404);
    expect((await view(deleted)).status).toBe(404);
    expect((await view("missing")).status).toBe(404);
    expect((await view(processing)).status).toBe(409);
    expect(await prisma.view.count()).toBe(0);
  });
});
