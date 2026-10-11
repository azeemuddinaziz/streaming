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

// Emits `ticks` evenly spaced percents from 0 to 100 while "transcoding".
const tickingTranscoder = (ticks: number, seen?: () => Promise<unknown>): Transcoder =>
  async (input, outputDir, onProgress) => {
    for (let i = 0; i <= ticks; i++) {
      onProgress?.((i / ticks) * 100);
      await seen?.();
    }
    return transcode(input, outputDir);
  };

describe("processing progress", () => {
  it("rises monotonically, is written throttled, and is 100 once ready", async () => {
    const video = await newVideo();
    const writes: (number | null)[] = [];
    const watcher = async () => {
      const { processingProgress } = await prisma.video.findUniqueOrThrow({ where: { id: video.id } });
      if (writes.at(-1) !== processingProgress) writes.push(processingProgress);
    };

    // A frozen clock, so only the 2-point rule can cause a write.
    await VideoProcessingService.process(
      video.id, fakeStorage().storage, tickingTranscoder(1000, watcher), () => 0,
    );

    const seen = writes.filter((value): value is number => value !== null);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    // 5 (download) .. 90 (transcoded) .. 99 (uploaded) in steps of at least 2 points.
    expect(seen.length).toBeGreaterThan(10);
    expect(seen.length).toBeLessThanOrEqual(52);
    expect(seen.every((value, i) => i === 0 || value - seen[i - 1] >= 2 || value === 100)).toBe(true);
    const done = await prisma.video.findUniqueOrThrow({ where: { id: video.id } });
    expect(done.status).toBe("READY");
    expect(done.processingProgress).toBe(100);
  });

  it("also writes a smaller step once two seconds have passed", async () => {
    const video = await newVideo();
    let clock = 0;
    const slow: Transcoder = async (input, outputDir, onProgress) => {
      onProgress?.(10);
      clock += 2500;
      onProgress?.(11);
      return transcode(input, outputDir);
    };
    let midway: number | null = null;
    const storage = fakeStorage().storage;
    const put = storage.put;
    storage.put = async (...args) => {
      midway ??= (await prisma.video.findUniqueOrThrow({ where: { id: video.id } })).processingProgress;
      return put(...args);
    };

    await VideoProcessingService.process(video.id, storage, slow, () => clock);

    // 5 + 11% of 85 = 14.35, floored; the 10% tick alone would be 13.
    expect(midway).toBe(14);
  });

  it("keeps the last value on a failed Video and never moves it backwards", async () => {
    const video = await newVideo();
    const failing: Transcoder = async (_input, _out, onProgress) => {
      onProgress?.(50);
      throw new Error("ffmpeg died");
    };

    await expect(
      VideoProcessingService.process(video.id, fakeStorage().storage, failing),
    ).rejects.toThrow("ffmpeg died");
    await VideoProcessingService.fail(video.id);

    const failed = await prisma.video.findUniqueOrThrow({ where: { id: video.id } });
    expect(failed.status).toBe("FAILED");
    expect(failed.processingProgress).toBe(47);
  });

  it("stays null when the transcoder reports nothing", async () => {
    const video = await newVideo();
    let during: number | null | undefined;
    const silent: Transcoder = async (input, outputDir) => {
      during = (await prisma.video.findUniqueOrThrow({ where: { id: video.id } })).processingProgress;
      return transcode(input, outputDir);
    };

    await VideoProcessingService.process(video.id, fakeStorage().storage, silent);

    // Only the download step is known, so the bar is never NaN or a guess.
    expect(during === null || during === 5).toBe(true);
  });
});

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
