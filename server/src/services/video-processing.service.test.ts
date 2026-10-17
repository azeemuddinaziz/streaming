import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Transcoder } from "../lib/ffmpeg.ts";
import { runJob, setWorkerEmit, type WorkerLine } from "../lib/worker-log.ts";
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

  it("stays null throughout when the transcoder reports nothing, then 100 when ready", async () => {
    const video = await newVideo();
    const seen: (number | null)[] = [];
    const storage = fakeStorage().storage;
    const put = storage.put;
    storage.put = async (...args) => {
      seen.push((await prisma.video.findUniqueOrThrow({ where: { id: video.id } })).processingProgress);
      return put(...args);
    };

    await VideoProcessingService.process(video.id, storage, transcode);

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((value) => value === null)).toBe(true);
    expect((await prisma.video.findUniqueOrThrow({ where: { id: video.id } })).processingProgress).toBe(100);
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

describe("worker lines while processing", () => {
  let lines: WorkerLine[];
  const attempt = { job: "process-video", jobId: "job-1", attempt: 1, final: false };

  beforeEach(() => {
    lines = [];
    setWorkerEmit((line) => lines.push(line));
  });

  afterEach(() => setWorkerEmit(null));

  // Reports 1000 ticks and finishes each Rendition, as ffmpeg would.
  const realistic: Transcoder = async (input, outputDir, onProgress, onRendition) => {
    for (let i = 0; i <= 1000; i++) {
      onProgress?.(i / 10);
      if (i === 500) onRendition?.("720p");
      if (i === 900) onRendition?.("360p");
    }
    return transcode(input, outputDir);
  };

  it("shows the phases, each Rendition and coarse progress, never one line per tick", async () => {
    const video = await newVideo();

    await runJob(attempt, () => VideoProcessingService.process(video.id, fakeStorage().storage, realistic));

    const shown = lines.map((l) =>
      l.event === "video.phase" ? `phase:${l.phase}`
      : l.event === "video.rendition" ? `rendition:${l.rendition}`
      : String(l.event),
    ).filter((name) => name !== "video.progress");
    expect(shown).toEqual([
      "job.started",
      "phase:downloading",
      "phase:transcoding",
      "rendition:720p",
      "rendition:360p",
      "phase:uploading",
      "phase:ready",
      "job.ended",
    ]);
    const progress = lines.filter((l) => l.event === "video.progress").map((l) => l.progress);
    expect(progress).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90]);
    // Every line after the start line names the Video, the end line included.
    expect(lines.slice(1).every((l) => l.videoId === video.id)).toBe(true);
    expect(lines.find((l) => l.phase === "ready")).toMatchObject({ renditions: 2 });
  });

  it("never writes the tusd id, even in an error that names it", async () => {
    const video = await newVideo();
    const { storage } = fakeStorage();
    storage.downloadOriginal = async (tusId) => {
      throw new Error(`ENOENT: no such file or directory, open 'data/uploads/${tusId}'`);
    };

    await expect(
      runJob(attempt, () => VideoProcessingService.process(video.id, storage, realistic)),
    ).rejects.toThrow();

    const text = JSON.stringify(lines);
    expect(text).not.toContain("orig+multipart");
    expect(lines.at(-1)).toMatchObject({ outcome: "retrying", error: { expected: false } });
  });

  it("logs a file that cannot be transcoded as an expected failure, and the Video marked failed", async () => {
    const video = await newVideo();
    const notAVideo: Transcoder = async () => {
      throw new Error("The file has no video stream.");
    };

    await expect(
      runJob({ ...attempt, attempt: 4, final: true }, async () => {
        try {
          await VideoProcessingService.process(video.id, fakeStorage().storage, notAVideo);
        } catch (error) {
          await VideoProcessingService.fail(video.id);
          throw error;
        }
      }),
    ).rejects.toThrow("The file has no video stream.");

    expect(lines.map((l) => l.event)).toContain("video.failed");
    expect(lines.at(-1)).toEqual(expect.objectContaining({
      outcome: "failed",
      final: true,
      error: { type: "TranscodeError", message: "The file has no video stream.", expected: true },
    }));
  });

  it("says why it skipped a Video that is no longer processing", async () => {
    const video = await newVideo();
    await VideoProcessingService.fail(video.id);

    await runJob(attempt, () => VideoProcessingService.process(video.id, fakeStorage().storage, realistic));

    expect(lines.find((l) => l.event === "video.skipped")).toMatchObject({ reason: "FAILED" });
  });
});

