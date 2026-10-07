import type { Request, Response } from "express";
import { UploadService } from "../services/uploads.service.ts";

export const UploadController = {
  // The signed-in person's Uploads that can still be resumed.
  async unfinished(req: Request, res: Response) {
    const uploads = await UploadService.listUnfinished(req.user!.id);
    res.status(200).json({ uploads });
  },
};
