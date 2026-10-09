import type { Request, Response } from "express";
import { VideoService } from "../services/videos.service.ts";

export const VideoController = {
  async get(req: Request, res: Response) {
    res.status(200).json({ msg: "Success" });
  },

  async create(req: Request, res: Response) {
    res.status(200).json({ msg: "Success" });
  },

  // The signed-in person's own Videos, for their studio.
  async mine(req: Request, res: Response) {
    const videos = await VideoService.listStudio(req.user!.id);
    res.status(200).json({ videos });
  },

  async update(req: Request, res: Response) {
    const video = await VideoService.updateDetails(req.user!.id, req.params.id as string, req.body ?? {});
    res.status(200).json({ video });
  },

  async retry(req: Request, res: Response) {
    await VideoService.retryProcessing(req.user!.id, req.params.id as string);
    res.status(202).json({ msg: "Processing started." });
  },
};
