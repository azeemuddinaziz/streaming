import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.ts";
import { UserRepository } from "../repositories/users.repository.ts";
import { resetDatabase, startTestApi } from "../test/helpers.ts";

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
  return await UserRepository.createWithChannel({
    email: `${name.toLowerCase()}@example.com`,
    name,
    nameKey: name.toLowerCase(),
    password: "unused",
  });
}

async function video(
  owner: Awaited<ReturnType<typeof person>>,
  title: string,
  data: { visibility?: "PRIVATE" | "UNLISTED" | "PUBLIC"; status?: "PROCESSING" | "READY"; deletedAt?: Date } = {},
) {
  const created = await prisma.video.create({
    data: {
      channelId: owner.channel!.id,
      title,
      description: "d",
      status: data.status ?? "READY",
      visibility: data.visibility ?? "PUBLIC",
      deletedAt: data.deletedAt,
    },
  });
  await prisma.video.update({
    where: { id: created.id },
    data: { thumbnailKey: `videos/${created.id}/thumbnail.jpg` },
  });
  return created.id;
}

describe("channel page", () => {
  it("lists only the Channel's public, ready, non-deleted Videos, newest first, found by name in any case", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const first = await video(ada, "First");
    const second = await video(ada, "Second");
    await video(ada, "Hidden", { visibility: "PRIVATE" });
    await video(ada, "Unlisted", { visibility: "UNLISTED" });
    await video(ada, "Gone", { deletedAt: new Date() });
    await video(ada, "Busy", { status: "PROCESSING" });
    await video(grace, "Not Ada's");

    const response = await api.request("/channels/ADA-lovelace");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.channel).toEqual({ name: "Ada-Lovelace" });
    expect(body.videos.map((v: { id: string }) => v.id)).toEqual([second, first]);
    expect(body.videos[0]).toMatchObject({
      title: "Second",
      thumbnailPath: expect.stringMatching(/^\/api\/v1\/media\/.+\/thumbnail\.jpg$/),
    });
  });

  it("is empty for a Channel with nothing public, and not found for an unknown name", async () => {
    await person("Ada-Lovelace");

    const empty = await api.request("/channels/ada-lovelace");
    expect(empty.status).toBe(200);
    expect((await empty.json()).videos).toEqual([]);

    const missing = await api.request("/channels/nobody");
    expect(missing.status).toBe(404);
  });
});

describe("channel page paging", () => {
  async function fill(owner: Awaited<ReturnType<typeof person>>, count: number) {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) ids.push(await video(owner, `Video ${i}`));
    return ids;
  }

  it("serves 24 per page, newest first, with hasMore and no leaked extra row", async () => {
    const ada = await person("Ada-Lovelace");
    const ids = await fill(ada, 25);
    await video(ada, "Hidden", { visibility: "PRIVATE" });
    await video(ada, "Gone", { deletedAt: new Date() });
    await video(ada, "Busy", { status: "PROCESSING" });
    // Newest first, ties by id, whatever the insertion timing was.
    const rows = await prisma.video.findMany({ where: { id: { in: ids } } });
    const newestFirst = rows
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1))
      .map((row) => row.id);

    const first = await (await api.request("/channels/ada-lovelace")).json();
    expect(first.page).toBe(1);
    expect(first.hasMore).toBe(true);
    expect(first.videos.map((v: { id: string }) => v.id)).toEqual(newestFirst.slice(0, 24));

    const second = await (await api.request("/channels/ada-lovelace?page=2")).json();
    expect(second.page).toBe(2);
    expect(second.hasMore).toBe(false);
    expect(second.videos.map((v: { id: string }) => v.id)).toEqual(newestFirst.slice(24));
    expect(second.channel).toEqual({ name: "Ada-Lovelace" });
    expect(second).toHaveProperty("subscribers");
  });

  it("has no more when exactly one page is full", async () => {
    const ada = await person("Ada-Lovelace");
    await fill(ada, 24);

    const body = await (await api.request("/channels/ada-lovelace")).json();
    expect(body.videos).toHaveLength(24);
    expect(body.hasMore).toBe(false);
  });

  it("answers an out-of-range page with no videos, and an invalid page as page 1", async () => {
    const ada = await person("Ada-Lovelace");
    await fill(ada, 2);

    const beyond = await (await api.request("/channels/ada-lovelace?page=9")).json();
    expect(beyond).toMatchObject({ videos: [], page: 9, hasMore: false });

    for (const bad of ["0", "-3", "abc", "1.5"]) {
      const body = await (await api.request(`/channels/ada-lovelace?page=${bad}`)).json();
      expect(body.page).toBe(1);
      expect(body.videos).toHaveLength(2);
    }
  });
});
