import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Transcoder } from "../lib/ffmpeg.ts";
import type { Storage } from "../lib/storage.ts";
import { prisma } from "../lib/prisma.ts";
import { UploadRepository } from "../repositories/uploads.repository.ts";
import { UserRepository } from "../repositories/users.repository.ts";
import { resetDatabase } from "../test/helpers.ts";
import { VideoProcessingService } from "./video-processing.service.ts";

beforeEach(async () => {
  await resetDatabase();
});

async function newVideo() {
  const user = await UserRepository.createWithChannel({
    email: "ada@example.com",
    name: "Ada-Lovelace",
    nameKey: "ada-lovelace",
    password: "unused",
  });
  await UploadRepository.record({ tusId: "orig+multipart", userId: user.id, filename: "a.mp4", size: 10 });
  return (await UploadRepository.completeIntoVideo("orig+multipart"))!;
}

// A storage that records what was asked of it. It has no delete, as the real one.
function fakeStorage() {
  const stored = new Map<string, string>();
  const storage: Storage = {
    async downloadOriginal(_tusId, destination) {
      await writeFile(destination, "original bytes");
    },
    async put(key, _file, contentType) {
      stored.set(key, contentType);
    },
    async read() {
      return undefined;
    },
    async signedUrl() {
      return undefined;
    },
  };
  return { storage, stored };
}

// Stands in for ffmpeg: two Renditions and a Thumbnail.
const transcode: Transcoder = async (_input, outputDir) => {
  const files = ["master.m3u8", "thumbnail.jpg", "720p/index.m3u8", "720p/segment_000.ts", "360p/index.m3u8"];
  for (const file of files) {
    const target = path.join(outputDir, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file);
  }
  return {
    files,
    masterPlaylist: "master.m3u8",
    thumbnail: "thumbnail.jpg",
    renditions: [
      { width: 1280, height: 720, bandwidth: 2928000, playlist: "720p/index.m3u8" },
      { width: 640, height: 360, bandwidth: 928000, playlist: "360p/index.m3u8" },
    ],
  };
};

describe("processing a video", () => {
  it("stores the Renditions and Thumbnail and marks the Video ready", async () => {
    const video = await newVideo();
    const { storage, stored } = fakeStorage();

    await VideoProcessingService.process(video.id, storage, transcode);

    const ready = await prisma.video.findUniqueOrThrow({
      where: { id: video.id },
      include: { renditions: { orderBy: { height: "desc" } } },
    });
    expect(ready.status).toBe("READY");
    expect(ready.thumbnailKey).toBe(`videos/${video.id}/thumbnail.jpg`);
    expect(ready.masterPlaylistKey).toBe(`videos/${video.id}/master.m3u8`);
    expect(ready.renditions.map((r) => [r.height, r.playlistKey])).toEqual([
      [720, `videos/${video.id}/720p/index.m3u8`],
      [360, `videos/${video.id}/360p/index.m3u8`],
    ]);
    expect([...stored.keys()].sort()).toEqual(
      [
        "master.m3u8", "thumbnail.jpg", "720p/index.m3u8", "720p/segment_000.ts", "360p/index.m3u8",
      ].map((file) => `videos/${video.id}/${file}`).sort(),
    );
    expect(stored.get(`videos/${video.id}/720p/segment_000.ts`)).toBe("video/mp2t");
    expect(stored.get(`videos/${video.id}/thumbnail.jpg`)).toBe("image/jpeg");
  });

  it("leaves the Video processing when a run fails, so the job can be retried", async () => {
    const video = await newVideo();

    await expect(
      VideoProcessingService.process(video.id, fakeStorage().storage, async () => {
        throw new Error("not a video");
      }),
    ).rejects.toThrow("not a video");

    expect((await prisma.video.findUniqueOrThrow({ where: { id: video.id } })).status).toBe("PROCESSING");
  });

  it("marks the Video failed once the job gives up, and never undoes a ready Video", async () => {
    const failing = await newVideo();
    await VideoProcessingService.fail(failing.id);
    expect((await prisma.video.findUniqueOrThrow({ where: { id: failing.id } })).status).toBe("FAILED");

    await resetDatabase();
    const done = await newVideo();
    await VideoProcessingService.process(done.id, fakeStorage().storage, transcode);
    await VideoProcessingService.fail(done.id);
    expect((await prisma.video.findUniqueOrThrow({ where: { id: done.id } })).status).toBe("READY");
  });

  it("does nothing for a Video that is no longer processing", async () => {
    const video = await newVideo();
    await VideoProcessingService.process(video.id, fakeStorage().storage, transcode);
    const { storage, stored } = fakeStorage();

    await VideoProcessingService.process(video.id, storage, transcode);

    expect(stored.size).toBe(0);
  });
});
