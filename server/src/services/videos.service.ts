import { HttpError } from "../errors.ts";
import { queueVideoProcessing } from "../lib/video-queue.ts";
import { VideoRepository } from "../repositories/videos.repository.ts";

export const VideoService = {
  // A Video is labelled with its Upload's filename until it has a title.
  async listStudio(userId: string) {
    const videos = await VideoRepository.listForUser(userId);

    return videos.map((video) => ({
      id: video.id,
      label: video.upload?.filename ?? "Untitled",
      status: video.status,
      visibility: video.visibility,
      createdAt: video.createdAt,
    }));
  },

  // Processes a failed Video again from its kept original. Someone else's Video
  // is reported as not found, the same as one that does not exist.
  async retryProcessing(userId: string, videoId: string) {
    const video = await VideoRepository.findOwned(videoId, userId);
    if (!video) throw new HttpError(404, "Video not found.");

    if (!(await VideoRepository.restartProcessing(videoId))) {
      throw new HttpError(409, "Only a failed video can be retried.");
    }

    try {
      await queueVideoProcessing(videoId);
    } catch (error) {
      console.error(`Could not queue processing of video ${videoId}:`, error);
      await VideoRepository.markFailed(videoId);
      throw new HttpError(503, "Processing could not be started. Try again in a moment.");
    }
  },
};
