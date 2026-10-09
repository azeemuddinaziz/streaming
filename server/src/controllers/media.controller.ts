import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { Request, Response } from "express";
import { HttpError } from "../errors.ts";
import { MEDIA_TOKEN_SECONDS, verifyMediaToken } from "../lib/media-token.ts";
import { createStorage } from "../lib/storage.ts";

const CONTENT_TYPES: Record<string, string> = {
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
  ".jpg": "image/jpeg",
};

const storage = createStorage();

export const MediaController = {
  // Serves one file of the Video named by the signed token in the address.
  // Playlists always come through the API, since their relative addresses must
  // resolve back to it; other files are handed to storage's own short-lived
  // address when it can sign one.
  async serve(req: Request, res: Response) {
    const videoId = await verifyMediaToken(req.params.token as string);
    if (!videoId) throw new HttpError(403, "This address has expired.");

    const segments = (req.params.path as unknown as string[]) ?? [];
    if (segments.length === 0 || segments.some((s) => !/^[\w][\w.-]*$/.test(s) || s.includes(".."))) {
      throw new HttpError(404, "Not found.");
    }
    const key = `videos/${videoId}/${segments.join("/")}`;
    const extension = path.extname(key);

    if (extension !== ".m3u8") {
      const url = await storage.signedUrl(key, MEDIA_TOKEN_SECONDS);
      if (url) return res.redirect(302, url);
    }

    const body = await storage.read(key);
    if (!body) throw new HttpError(404, "Not found.");
    res.type(CONTENT_TYPES[extension] ?? "application/octet-stream");
    res.set("Cache-Control", "private, max-age=300");
    await pipeline(body, res);
  },
};
