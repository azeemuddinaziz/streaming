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
};

export const VideoProcessingService = {
  // Turns a processing Video into HLS Renditions and a Thumbnail stored beside
  // the original, then marks it ready. The original is only read. Throws if
  // anything fails, leaving the Video processing so the job can be retried;
  // `fail` is what finally gives up on it.
  async process(videoId: string, storage: Storage, transcode: Transcoder) {
    const video = await VideoRepository.findForProcessing(videoId);
    if (!video || video.status !== "PROCESSING") return;
    if (!video.upload) throw new Error(`Video ${videoId} has no Upload to process.`);

    const workDir = await mkdtemp(path.join(tmpdir(), "streamsouk-"));
    try {
      const original = path.join(workDir, "original");
      const output = path.join(workDir, "out");
      await storage.downloadOriginal(video.upload.tusId, original);
      const result = await transcode(original, output);

      const prefix = `videos/${videoId}/`;
      for (const file of result.files) {
        const type = CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream";
        await storage.put(prefix + file.split(path.sep).join("/"), path.join(output, file), type);
      }

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
