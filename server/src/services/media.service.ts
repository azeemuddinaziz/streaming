import path from "node:path";
import { HttpError } from "../errors.ts";
import { verifyMediaToken } from "../lib/media-token.ts";
import { createStorage } from "../lib/storage.ts";
import { enrich } from "../lib/wide-event.ts";
import { VideoRepository } from "../repositories/videos.repository.ts";

const CONTENT_TYPES: Record<string, string> = {
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

// A storage address only needs to outlive one request; the player asks again
// through the API for every segment.
const SIGNED_URL_SECONDS = 5 * 60;

// The Thumbnail address may be cached for 5 minutes (a redirect included), so
// what it redirects to must outlive that cache by a wide margin.
const THUMBNAIL_SIGNED_URL_SECONDS = 60 * 60;

const storage = createStorage();

// One stored file: storage's own short-lived address when allowed and it can
// sign one, else the bytes, or 404 when there are none.
async function deliver(key: string, { signed, seconds = SIGNED_URL_SECONDS }: { signed: boolean; seconds?: number }) {
  if (signed) {
    const url = await storage.signedUrl(key, seconds);
    if (url) return { redirect: url, body: undefined } as const;
  }

  const body = await storage.read(key);
  if (!body) throw new HttpError(404, "Not found.");
  const contentType = CONTENT_TYPES[path.extname(key)] ?? "application/octet-stream";
  return { redirect: undefined, body, contentType } as const;
}

export const MediaService = {
  // Finds one file of the Video named by a signed token. Playlists are always
  // streamed by the API, since their relative addresses must resolve back to
  // it; other files get storage's own short-lived address when it can sign one.
  async resolve(token: string, segments: string[]) {
    const videoId = await verifyMediaToken(token);
    if (!videoId) throw new HttpError(403, "This address has expired.");

    if (segments.length === 0 || segments.some((s) => !/^\w[\w.-]*$/.test(s) || s.includes(".."))) {
      throw new HttpError(404, "Not found.");
    }
    const key = `videos/${videoId}/${segments.join("/")}`;
    const extension = path.extname(key);

    return await deliver(key, { signed: extension !== ".m3u8" });
  },

  // The Thumbnail of a Video anyone may know of: ready, not deleted, not
  // PRIVATE. Everything else, for the owner too, is "not found", which reveals
  // nothing. Delivered as `resolve` delivers other files.
  async thumbnail(videoId: string) {
    enrich({ videoId });
    const video = await VideoRepository.findForThumbnail(videoId);
    if (!video?.thumbnailKey || video.status !== "READY" || video.visibility === "PRIVATE") {
      throw new HttpError(404, "Not found.");
    }

    return await deliver(video.thumbnailKey, { signed: true, seconds: THUMBNAIL_SIGNED_URL_SECONDS });
  },
};
