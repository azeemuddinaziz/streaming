import { Readable } from "node:stream";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../lib/prisma.ts";
import { UserRepository } from "../repositories/users.repository.ts";
import { resetDatabase, startTestApi } from "../test/helpers.ts";
import { signToken } from "../utils/jwt.ts";

// Storage is its own seam: a fake holds the processed files and can sign URLs.
const files = new Map<string, string>();
let signing = false;
vi.mock("../lib/storage.ts", () => ({
  createStorage: () => ({
    read: async (key: string) => (files.has(key) ? Readable.from([files.get(key)!]) : undefined),
    signedUrl: async (key: string, seconds: number) =>
      signing ? `https://bucket.example/${key}?expires=${seconds}` : undefined,
  }),
}));

let api: Awaited<ReturnType<typeof startTestApi>>;
beforeAll(async () => {
  api = await startTestApi();
});
afterAll(async () => {
  await api.close();
});
beforeEach(async () => {
  files.clear();
  signing = false;
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
  data: {
    status?: "PROCESSING" | "READY" | "FAILED";
    visibility?: "PRIVATE" | "UNLISTED" | "PUBLIC";
    deletedAt?: Date;
  } = {},
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
      thumbnailKey: "placeholder",
    },
  });
  const key = `videos/${created.id}/thumbnail.jpg`;
  await prisma.video.update({ where: { id: created.id }, data: { thumbnailKey: key } });
  files.set(key, "generated-bytes");
  return { id: created.id, key };
}

describe("the stable Thumbnail address", () => {
  it("serves a ready public or unlisted Video's Thumbnail to anyone, with no token", async () => {
    const ada = await person("Ada-Lovelace");
    for (const visibility of ["PUBLIC", "UNLISTED"] as const) {
      const { id } = await video(ada, { visibility });

      const response = await api.request(`/videos/${id}/thumbnail`);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/jpeg");
      expect(response.headers.get("cache-control")).toBe("public, max-age=300");
      expect(await response.text()).toBe("generated-bytes");
    }
  });

  it("redirects to a short-lived storage address when the store can sign", async () => {
    const ada = await person("Ada-Lovelace");
    const { id, key } = await video(ada);
    signing = true;

    const response = await api.request(`/videos/${id}/thumbnail`, { redirect: "manual" });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`https://bucket.example/${key}?expires=3600`);
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("is not found for a missing, deleted, private or not-ready Video, the owner included", async () => {
    const ada = await person("Ada-Lovelace");
    const priv = await video(ada, { visibility: "PRIVATE" });
    const processing = await video(ada, { status: "PROCESSING" });
    const failed = await video(ada, { status: "FAILED" });
    const deleted = await video(ada, { deletedAt: new Date() });
    const ids = [
      priv.id,
      processing.id,
      failed.id,
      deleted.id,
      "00000000-0000-4000-8000-000000000000",
    ];

    for (const id of ids) {
      expect((await api.request(`/videos/${id}/thumbnail`)).status).toBe(404);
      expect((await api.request(`/videos/${id}/thumbnail`, { headers: ada.bearer })).status).toBe(404);
    }
  });

  it("is not found when the stored object is missing", async () => {
    const ada = await person("Ada-Lovelace");
    const { id, key } = await video(ada);
    files.delete(key);

    expect((await api.request(`/videos/${id}/thumbnail`)).status).toBe(404);
  });

  it("serves a replaced Thumbnail next", async () => {
    const ada = await person("Ada-Lovelace");
    const { id } = await video(ada);
    const custom = `videos/${id}/thumbnails/abc/w640.jpg`;
    files.set(custom, "custom-bytes");
    await prisma.video.update({ where: { id }, data: { thumbnailKey: custom } });

    const response = await api.request(`/videos/${id}/thumbnail`);

    expect(await response.text()).toBe("custom-bytes");
  });
});
