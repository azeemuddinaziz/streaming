import { Readable } from "node:stream";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../lib/prisma.ts";
import { UserRepository } from "../repositories/users.repository.ts";
import { resetDatabase, startTestApi } from "../test/helpers.ts";
import { signToken } from "../utils/jwt.ts";
import { signMediaToken } from "../lib/media-token.ts";

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
  data: { status?: "PROCESSING" | "READY" | "FAILED"; visibility?: "PRIVATE" | "UNLISTED" | "PUBLIC" } = {},
) {
  const channel = await prisma.channel.findUniqueOrThrow({ where: { userId: owner.user.id } });
  const created = await prisma.video.create({
    data: {
      channelId: channel.id,
      title: "Holiday",
      description: "Two weeks away",
      status: data.status ?? "READY",
      visibility: data.visibility ?? "PUBLIC",
      masterPlaylistKey: "placeholder",
      thumbnailKey: "placeholder",
    },
  });
  const prefix = `videos/${created.id}/`;
  await prisma.video.update({
    where: { id: created.id },
    data: { masterPlaylistKey: `${prefix}master.m3u8`, thumbnailKey: `${prefix}thumbnail.jpg` },
  });
  files.set(`${prefix}master.m3u8`, "#EXTM3U\n720p/index.m3u8\n");
  files.set(`${prefix}720p/segment_000.ts`, "bytes");
  return created.id;
}

describe("watching a Video", () => {
  it("gives an anonymous Viewer a ready public or unlisted Video with a playable address", async () => {
    const ada = await person("Ada-Lovelace");
    for (const visibility of ["PUBLIC", "UNLISTED"] as const) {
      const id = await video(ada, { visibility });

      const response = await api.request(`/videos/${id}/watch`);
      const { video: watched } = await response.json();

      expect(response.status).toBe(200);
      expect(watched).toMatchObject({
        id,
        title: "Holiday",
        description: "Two weeks away",
        status: "READY",
        channelName: "Ada-Lovelace",
      });
      const playlist = await api.request(watched.playlistPath.replace("/api/v1", ""));
      expect(playlist.status).toBe(200);
      expect(await playlist.text()).toContain("#EXTM3U");
    }
  });

  it("shows a private Video only to its owner; everyone else gets not found", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await video(ada, { visibility: "PRIVATE" });

    const statuses = [
      (await api.request(`/videos/${id}/watch`)).status,
      (await api.request(`/videos/${id}/watch`, { headers: grace.bearer })).status,
      (await api.request(`/videos/${id}/watch`, { headers: ada.bearer })).status,
      (await api.request("/videos/nope/watch")).status,
    ];

    expect(statuses).toEqual([404, 404, 200, 404]);
  });

  it("tells a Viewer a Video that is not ready is still processing, with no player address", async () => {
    const ada = await person("Ada-Lovelace");
    for (const status of ["PROCESSING", "FAILED"] as const) {
      const id = await video(ada, { status });

      const { video: watched } = await (await api.request(`/videos/${id}/watch`)).json();

      expect(watched.status).toBe("PROCESSING");
      expect(watched.playlistPath).toBeUndefined();
    }
  });

  it("lets the owner see that processing failed", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada, { status: "FAILED" });

    const { video: watched } = await (await api.request(`/videos/${id}/watch`, { headers: ada.bearer })).json();

    expect(watched.status).toBe("FAILED");
  });
});

describe("signed media addresses", () => {
  it("refuses an expired, forged or mismatched address", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada);

    const expired = await signMediaToken(id, new Date(Date.now() - 7 * 60 * 60 * 1000));
    const otherVideo = await signMediaToken("another", new Date());
    const good = await signMediaToken(id, new Date());

    expect((await api.request(`/media/${expired}/master.m3u8`)).status).toBe(403);
    expect((await api.request(`/media/forged/master.m3u8`)).status).toBe(403);
    expect((await api.request(`/media/${otherVideo}/master.m3u8`)).status).toBe(404);
    expect((await api.request(`/media/${good}/master.m3u8`)).status).toBe(200);
  });

  it("stays inside the Video's own folder", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada);
    const token = await signMediaToken(id, new Date());

    const escape = await api.request(`/media/${token}/..%2F..%2Fother/master.m3u8`);

    expect(escape.status).toBe(404);
  });

  it("streams segments from the API when storage cannot sign, and redirects to a short-lived storage address when it can", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada);
    const token = await signMediaToken(id, new Date());

    const direct = await api.request(`/media/${token}/720p/segment_000.ts`);
    expect(direct.status).toBe(200);
    expect(await direct.text()).toBe("bytes");

    signing = true;
    const redirected = await api.request(`/media/${token}/720p/segment_000.ts`, { redirect: "manual" });
    expect(redirected.status).toBe(302);
    expect(redirected.headers.get("location")).toMatch(
      new RegExp(`^https://bucket\\.example/videos/${id}/720p/segment_000\\.ts\\?expires=\\d+$`),
    );
  });

  it("does not serve a file the Video does not have", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await video(ada);
    const token = await signMediaToken(id, new Date());

    expect((await api.request(`/media/${token}/missing.ts`)).status).toBe(404);
  });
});
