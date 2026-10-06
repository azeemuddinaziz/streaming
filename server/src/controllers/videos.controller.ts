import type { Request, Response } from "express";

export const VideoController = {
  async get(req: Request, res: Response) {
    res.status(200).json({ msg: "Success" });
  },

  async create(req: Request, res: Response) {
    res.status(200).json({ msg: "Success" });
  },
};
