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
