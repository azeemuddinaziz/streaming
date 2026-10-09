import path from "node:path";
import { HttpError } from "../errors.ts";
import { verifyMediaToken } from "../lib/media-token.ts";
import { createStorage } from "../lib/storage.ts";

const CONTENT_TYPES: Record<string, string> = {
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

// A storage address only needs to outlive one request; the player asks again
// through the API for every segment.
const SIGNED_URL_SECONDS = 5 * 60;

const storage = createStorage();

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

    if (extension !== ".m3u8") {
      const url = await storage.signedUrl(key, SIGNED_URL_SECONDS);
      if (url) return { redirect: url, body: undefined } as const;
    }

    const body = await storage.read(key);
    if (!body) throw new HttpError(404, "Not found.");
    return { redirect: undefined, body, contentType: CONTENT_TYPES[extension] ?? "application/octet-stream" } as const;
  },
};
