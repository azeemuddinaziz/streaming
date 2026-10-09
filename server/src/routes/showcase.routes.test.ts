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

let clock = Date.parse("2026-01-01T00:00:00Z");
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
      createdAt: new Date((clock += 60_000)),
    },
  });
  await prisma.video.update({
    where: { id: created.id },
    data: { thumbnailKey: `videos/${created.id}/thumbnail.jpg` },
  });
  return created.id;
}

describe("public showcase", () => {
  it("lists public, ready, non-deleted Videos of every Channel, newest first, with channel name", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const first = await video(ada, "First");
    const second = await video(grace, "Second");
    await video(ada, "Private", { visibility: "PRIVATE" });
    await video(ada, "Unlisted", { visibility: "UNLISTED" });
    await video(grace, "Deleted", { deletedAt: new Date() });
    await video(grace, "Busy", { status: "PROCESSING" });

    const response = await api.request("/videos");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.videos.map((v: { id: string }) => v.id)).toEqual([second, first]);
    expect(body.videos[0]).toMatchObject({
      title: "Second",
      channelName: "Grace-Hopper",
      thumbnailPath: expect.stringMatching(/^\/api\/v1\/media\/.+\/thumbnail\.jpg$/),
    });
    expect(body.hasMore).toBe(false);
  });

  it("is empty when nothing is public yet", async () => {
    const ada = await person("Ada-Lovelace");
    await video(ada, "Private", { visibility: "PRIVATE" });

    const body = await (await api.request("/videos")).json();
    expect(body).toMatchObject({ videos: [], page: 1, hasMore: false });
  });

  it("returns a page at a time, with no overlap, and says when there is more", async () => {
    const ada = await person("Ada-Lovelace");
    const ids: string[] = [];
    for (let i = 0; i < 25; i++) ids.push(await video(ada, `V${i}`));
    ids.reverse();

    const one = await (await api.request("/videos")).json();
    expect(one.videos).toHaveLength(24);
    expect(one.hasMore).toBe(true);
    expect(one.videos.map((v: { id: string }) => v.id)).toEqual(ids.slice(0, 24));

    const two = await (await api.request("/videos?page=2")).json();
    expect(two.page).toBe(2);
    expect(two.videos.map((v: { id: string }) => v.id)).toEqual(ids.slice(24));
    expect(two.hasMore).toBe(false);
  });

  it("treats a bad page number as the first page", async () => {
    for (const page of ["0", "-3", "abc", "1.5", "1e21"]) {
      const body = await (await api.request(`/videos?page=${page}`)).json();
      expect(body.page).toBe(1);
    }
  });
});
