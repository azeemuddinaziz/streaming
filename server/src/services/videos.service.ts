import { HttpError } from "../errors.ts";
import { queueVideoProcessing } from "../lib/video-queue.ts";
import { VideoRepository } from "../repositories/videos.repository.ts";

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 5000;
const VISIBILITIES = ["PRIVATE", "UNLISTED", "PUBLIC"] as const;

// Reads an optional text field: undefined when absent, null when blank.
function text(value: unknown, field: string, max: number) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new HttpError(400, `The ${field} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new HttpError(400, `The ${field} can be at most ${max} characters.`);
  return trimmed === "" ? null : trimmed;
}

export const VideoService = {
  // A Video is labelled with its Upload's filename until it has a title.
  async listStudio(userId: string) {
    const videos = await VideoRepository.listForUser(userId);

    return videos.map((video) => ({
      id: video.id,
      label: video.title ?? video.upload?.filename ?? "Untitled",
      title: video.title,
      description: video.description,
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

  // Saves the owner's title, description and Visibility, whatever the Video's
  // processing status. A Video leaves private only if the result has both a
  // title and a description; the filename label never counts as a title.
  async updateDetails(userId: string, videoId: string, body: unknown) {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new HttpError(400, "Send the details as a JSON object.");
    }
    const fields = body as Record<string, unknown>;
    const video = await VideoRepository.findOwned(videoId, userId);
    if (!video) throw new HttpError(404, "Video not found.");

    const title = text(fields.title, "title", TITLE_MAX);
    const description = text(fields.description, "description", DESCRIPTION_MAX);
    const visibility = fields.visibility;
    if (visibility !== undefined && !VISIBILITIES.includes(visibility as never)) {
      throw new HttpError(400, "Visibility must be PRIVATE, UNLISTED or PUBLIC.");
    }

    const data = {
      title: title && title.toLowerCase() === video.upload?.filename.toLowerCase() ? null : title,
      description,
      visibility: visibility as (typeof VISIBILITIES)[number] | undefined,
    };
    const result = {
      title: data.title === undefined ? video.title : data.title,
      description: data.description === undefined ? video.description : data.description,
      visibility: data.visibility ?? video.visibility,
    };
    if (result.visibility !== "PRIVATE" && (!result.title || !result.description)) {
      throw new HttpError(400, "Add a title and a description before making a video unlisted or public.");
    }

    if (!(await VideoRepository.updateDetails(video, data))) {
      throw new HttpError(409, "This video was changed elsewhere. Reload and try again.");
    }
    return { id: videoId, ...result };
  },
};
