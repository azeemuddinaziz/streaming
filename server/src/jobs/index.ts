import type { JobRunner } from "../lib/jobs.ts";
import { transcode } from "../lib/ffmpeg.ts";
import { createStorage } from "../lib/storage.ts";
import { removeUploadBytes } from "../lib/tusd.ts";
import { PROCESS_VIDEO_JOB } from "../lib/video-queue.ts";
import { UploadService } from "../services/uploads.service.ts";
import { VideoProcessingService } from "../services/video-processing.service.ts";

// Every background job the worker runs is registered here.
export async function registerJobs(jobs: JobRunner) {
  // Removes Uploads left unfinished for over 24 hours, with their bytes.
  jobs.register(
    "discard-stale-uploads",
    () => UploadService.discardStale(removeUploadBytes).then(() => undefined),
    { schedule: "0 * * * *" },
  );

  // Encodes a new Video into Renditions and a Thumbnail. The job runner retries
  // a failure; once it will not retry again the Video is marked failed.
  const storage = createStorage();
  jobs.register(PROCESS_VIDEO_JOB, async ({ videoId }: { videoId: string }, { final }) => {
    try {
      await VideoProcessingService.process(videoId, storage, transcode);
    } catch (error) {
      if (final) await VideoProcessingService.fail(videoId);
      throw error;
    }
  });
}
