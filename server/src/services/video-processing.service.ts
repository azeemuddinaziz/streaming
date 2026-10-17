import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { VideoRepository } from "../repositories/videos.repository.ts";
import type { Transcoder } from "../lib/ffmpeg.ts";
import type { Storage } from "../lib/storage.ts";
import { enrichJob, jobLog, redactInJob } from "../lib/worker-log.ts";

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
// The worker logs the progress written each time it crosses a multiple of this.
const LOG_EVERY_POINTS = 10;

// Writes progress to the Video, throttled, and tells the worker's terminal each
// time it passes a multiple of LOG_EVERY_POINTS. Writes are chained so they land
// in order, and a failed one is dropped: the bar is cosmetic and must never fail
// a job. Nothing is written until the transcoder has reported once (`start`),
// so a source whose length is unknown stays null instead of showing a guess.
function progressWriter(videoId: string, now: () => number) {
  let started = false;
  let written = -Infinity;
  let writtenAt = 0;
  let loggedStep = 0;
  let chain: Promise<void> = Promise.resolve();
  return {
    start() {
      started = true;
    },
    report(percent: number) {
      if (!started) return;
      const value = Math.min(99, Math.max(0, Math.floor(percent)));
      const moved = value - written;
      if (moved <= 0) return;
      if (moved < WRITE_EVERY_POINTS && now() - writtenAt < WRITE_EVERY_MS) return;
      written = value;
      writtenAt = now();
      const step = Math.floor(value / LOG_EVERY_POINTS) * LOG_EVERY_POINTS;
      if (step > loggedStep) {
        loggedStep = step;
        jobLog("video.progress", { progress: step });
      }
      chain = chain.then(() => VideoRepository.setProgress(videoId, value)).catch(() => undefined);
    },
    settled: () => chain,
  };
}

export const VideoProcessingService = {
  // One attempt of the process-video job. A failure is rethrown so the job runner
  // retries it; once no retry follows (`final`) the Video is marked failed first.
  async attempt(videoId: string, { final }: { final: boolean }, storage: Storage, transcode: Transcoder) {
    try {
      await VideoProcessingService.process(videoId, storage, transcode);
    } catch (error) {
      if (final) await VideoProcessingService.fail(videoId);
      throw error;
    }
  },

  // Turns a processing Video into HLS Renditions and a Thumbnail stored beside
  // the original, then marks it ready. The original is only read. Throws if
  // anything fails, leaving the Video processing so the job can be retried;
  // `fail` is what finally gives up on it.
  async process(videoId: string, storage: Storage, transcode: Transcoder, now: () => number = Date.now) {
    enrichJob({ videoId });
    const video = await VideoRepository.findForProcessing(videoId);
    if (!video || video.status !== "PROCESSING") {
      jobLog("video.skipped", { reason: video ? video.status : "missing" });
      return;
    }
    if (!video.upload) throw new Error(`Video ${videoId} has no Upload to process.`);
    // The tusd id is a capability and a storage error can name it, or the part
    // before "+" that the S3 store keeps the bytes under.
    redactInJob(video.upload.tusId, ...video.upload.tusId.split("+"));

    const progress = progressWriter(videoId, now);
    const workDir = await mkdtemp(path.join(tmpdir(), "streamsouk-"));
    try {
      const original = path.join(workDir, "original");
      const output = path.join(workDir, "out");
      jobLog("video.phase", { phase: "downloading" });
      await storage.downloadOriginal(video.upload.tusId, original);
      jobLog("video.phase", { phase: "transcoding" });
      const result = await transcode(
        original,
        output,
        (percent) => {
          progress.start();
          progress.report(DOWNLOAD_WEIGHT + (percent / 100) * TRANSCODE_WEIGHT);
        },
        (rendition) => jobLog("video.rendition", { rendition }),
      );

      const prefix = `videos/${videoId}/`;
      const base = DOWNLOAD_WEIGHT + TRANSCODE_WEIGHT;
      jobLog("video.phase", { phase: "uploading", files: result.files.length });
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
      jobLog("video.phase", { phase: "ready", renditions: result.renditions.length });
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  },

  // Gives up on a Video so it does not sit in processing forever.
  async fail(videoId: string) {
    if (await VideoRepository.markFailed(videoId)) jobLog("video.failed");
  },
};
