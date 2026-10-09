import { pipeline } from "node:stream/promises";
import type { Request, Response } from "express";
import { MediaService } from "../services/media.service.ts";

export const MediaController = {
  async serve(req: Request, res: Response) {
    const file = await MediaService.resolve(
      req.params.token as string,
      (req.params.path as unknown as string[]) ?? [],
    );
    if (file.redirect) return res.redirect(302, file.redirect);

    res.type(file.contentType!);
    res.set("Cache-Control", "private, max-age=300");
    await pipeline(file.body!, res);
  },
};
