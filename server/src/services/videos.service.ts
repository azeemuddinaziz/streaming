import { createHmac, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { HttpError } from "../errors.ts";
import { mediaPath, signMediaToken } from "../lib/media-token.ts";
import { createStorage } from "../lib/storage.ts";
import { THUMBNAIL_DEFAULT, makeThumbnails } from "../lib/thumbnail.ts";
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

const storage = createStorage();

// Anonymous Viewers are told apart by a keyed hash of address and browser, so
// the raw IP address is never stored and the hash cannot be reversed by
// trying every address.
function anonymousKey(ip: string | undefined, userAgent: string | undefined) {
  const hash = createHmac("sha256", process.env.JWT_SECRET!).update(`${ip ?? ""}\n${userAgent ?? ""}`).digest("hex");
  return `anon:${hash}`;
}

const SHOWCASE_PAGE_SIZE = 24;

export const VideoService = {
  // One page of the home page showcase. A page number that is not a whole
  // number from 1 is the first page.
  async listPublic(pageParam: unknown) {
    const parsed = Number(pageParam);
    const page = Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;

    const rows = await VideoRepository.listPublic((page - 1) * SHOWCASE_PAGE_SIZE, SHOWCASE_PAGE_SIZE);
    const videos = await Promise.all(
      rows.slice(0, SHOWCASE_PAGE_SIZE).map(async (video) => ({
        id: video.id,
        title: video.title,
        createdAt: video.createdAt,
        channelName: video.channel.user.name,
        thumbnailPath: video.thumbnailKey ? await mediaPath(video.id, video.thumbnailKey) : null,
      })),
    );
    return { videos, page, hasMore: rows.length > SHOWCASE_PAGE_SIZE };
  },

  // What the watch page needs. A private Video, like a missing one, is not
  // found for anyone but its owner. Anyone but the owner is told a Video that
  // is not ready is still processing; only a ready one gets playable addresses.
  async watch(viewerId: string | undefined, videoId: string) {
    const video = await VideoRepository.findForWatch(videoId);
    const isOwner = viewerId !== undefined && video?.channel.userId === viewerId;
    if (!video || (video.visibility === "PRIVATE" && !isOwner)) {
      throw new HttpError(404, "Video not found.");
    }

    const status = video.status === "FAILED" && !isOwner ? "PROCESSING" : video.status;
    const base = {
      id: video.id,
      title: video.title,
      description: video.description,
      status,
      channelName: video.channel.user.name,
      createdAt: video.createdAt,
      views: video._count.views,
    };
    if (status !== "READY" || !video.masterPlaylistKey) return base;

    const token = await signMediaToken(video.id);
    const prefix = `videos/${video.id}/`;
    return {
      ...base,
      playlistPath: `/api/v1/media/${token}/${video.masterPlaylistKey.slice(prefix.length)}`,
    };
  },

  // Counts a View of a Video the Viewer can watch, once per Viewer per Video
  // per UTC day. The owner's own watching never counts. The browser decides
  // when playback has run long enough; the API cannot see playback.
  async recordView(
    viewer: { userId?: string; ip?: string; userAgent?: string },
    videoId: string,
    now = new Date(),
  ) {
    const video = await VideoRepository.findForWatch(videoId);
    const isOwner = viewer.userId !== undefined && video?.channel.userId === viewer.userId;
    if (!video || (video.visibility === "PRIVATE" && !isOwner)) {
      throw new HttpError(404, "Video not found.");
    }
    if (video.status !== "READY") throw new HttpError(409, "This video is not ready to be watched.");

    const counted =
      !isOwner &&
      (await VideoRepository.addView(
        videoId,
        viewer.userId ? `user:${viewer.userId}` : anonymousKey(viewer.ip, viewer.userAgent),
        now.toISOString().slice(0, 10),
      ));
    return { counted, views: await VideoRepository.countViews(videoId) };
  },

  // A Video is labelled with its Upload's filename until it has a title.
  async listStudio(userId: string) {
    const videos = await VideoRepository.listForUser(userId);

    return await Promise.all(videos.map(async (video) => ({
      id: video.id,
      label: video.title ?? video.upload?.filename ?? "Untitled",
      title: video.title,
      description: video.description,
      status: video.status,
      visibility: video.visibility,
      createdAt: video.createdAt,
      thumbnailPath: video.thumbnailKey ? await mediaPath(video.id, video.thumbnailKey) : null,
    })));
  },

  // Replaces a ready Video's Thumbnail with the owner's image, stored in every
  // size and format under a fresh folder so old addresses never show stale bytes.
  async replaceThumbnail(userId: string, videoId: string, body: unknown) {
    const video = await VideoRepository.findOwned(videoId, userId);
    if (!video) throw new HttpError(404, "Video not found.");
    if (video.status !== "READY") {
      throw new HttpError(409, "The thumbnail can be changed once the video has finished processing.");
    }
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new HttpError(415, "Choose an image file (PNG, JPEG, WebP or similar).");
    }

    const files = await makeThumbnails(body);
    if (!files) throw new HttpError(415, "That file is not an image we can read. Choose a PNG, JPEG or WebP.");

    const prefix = `videos/${videoId}/thumbnails/${randomUUID()}/`;
    const workDir = await mkdtemp(path.join(tmpdir(), "streamsouk-thumb-"));
    try {
      for (const file of files) {
        const local = path.join(workDir, file.name);
        await writeFile(local, file.bytes);
        await storage.put(prefix + file.name, local, file.contentType);
      }
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }

    const thumbnailKey = prefix + THUMBNAIL_DEFAULT;
    if (!(await VideoRepository.setThumbnail(videoId, thumbnailKey))) {
      throw new HttpError(404, "Video not found.");
    }
    return { id: videoId, thumbnailPath: await mediaPath(videoId, thumbnailKey) };
  },

  // Deletes a Video from everyone's view. It is only flagged, and its rows and
  // files stay (ADR 0001). Someone else's, a missing or an already deleted Video is not found.
  async remove(userId: string, videoId: string) {
    if (!(await VideoRepository.softDelete(videoId, userId))) {
      throw new HttpError(404, "Video not found.");
    }
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
