import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { VideoRepository } from "../repositories/videos.repository.ts";
import type { Transcoder } from "../lib/ffmpeg.ts";
import type { Storage } from "../lib/storage.ts";

const CONTENT_TYPES: Record<string, string> = {
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

// Share of the bar for each phase: downloading the original, transcoding, then
// uploading the output. READY itself is 100.
const DOWNLOAD_WEIGHT = 5;
const UPLOAD_WEIGHT = 10;
const TRANSCODE_WEIGHT = 100 - DOWNLOAD_WEIGHT - UPLOAD_WEIGHT;
// A write is skipped unless the bar moved this far, or this long has passed.
const WRITE_EVERY_POINTS = 2;
const WRITE_EVERY_MS = 2000;

// Writes progress to the Video, throttled. Writes are chained so they land in
// order, and a failed one is dropped: the bar is cosmetic and must never fail
// a job.
function progressWriter(videoId: string, now: () => number) {
  let written = -Infinity;
  let writtenAt = 0;
  let chain: Promise<void> = Promise.resolve();
  return {
    report(percent: number) {
      const value = Math.min(99, Math.max(0, Math.floor(percent)));
      const moved = value - written;
      if (moved <= 0) return;
      if (moved < WRITE_EVERY_POINTS && now() - writtenAt < WRITE_EVERY_MS) return;
      written = value;
      writtenAt = now();
      chain = chain.then(() => VideoRepository.setProgress(videoId, value)).catch(() => undefined);
    },
    settled: () => chain,
  };
}

export const VideoProcessingService = {
  // Turns a processing Video into HLS Renditions and a Thumbnail stored beside
  // the original, then marks it ready. The original is only read. Throws if
  // anything fails, leaving the Video processing so the job can be retried;
  // `fail` is what finally gives up on it.
  async process(videoId: string, storage: Storage, transcode: Transcoder, now: () => number = Date.now) {
    const video = await VideoRepository.findForProcessing(videoId);
    if (!video || video.status !== "PROCESSING") return;
    if (!video.upload) throw new Error(`Video ${videoId} has no Upload to process.`);

    const progress = progressWriter(videoId, now);
    const workDir = await mkdtemp(path.join(tmpdir(), "streamsouk-"));
    try {
      const original = path.join(workDir, "original");
      const output = path.join(workDir, "out");
      await storage.downloadOriginal(video.upload.tusId, original);
      progress.report(DOWNLOAD_WEIGHT);
      const result = await transcode(original, output, (percent) =>
        progress.report(DOWNLOAD_WEIGHT + (percent / 100) * TRANSCODE_WEIGHT),
      );

      const prefix = `videos/${videoId}/`;
      const base = DOWNLOAD_WEIGHT + TRANSCODE_WEIGHT;
      for (const [index, file] of result.files.entries()) {
        const type = CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream";
        await storage.put(prefix + file.split(path.sep).join("/"), path.join(output, file), type);
        progress.report(base + (UPLOAD_WEIGHT * (index + 1)) / result.files.length);
      }
      // Let queued writes land first, so none can follow the READY write.
      await progress.settled();

      await VideoRepository.markReady(videoId, {
        masterPlaylistKey: prefix + result.masterPlaylist,
        thumbnailKey: prefix + result.thumbnail,
        renditions: result.renditions.map((r) => ({
          width: r.width,
          height: r.height,
          bandwidth: r.bandwidth,
          playlistKey: prefix + r.playlist,
        })),
      });
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  },

  // Gives up on a Video so it does not sit in processing forever.
  async fail(videoId: string) {
    await VideoRepository.markFailed(videoId);
  },
};
