import type { Request, Response } from "express";
import { ChannelService } from "../services/channels.service.ts";

export const ChannelController = {
  async page(req: Request, res: Response) {
    res.status(200).json(await ChannelService.page(req.params.name as string));
  },
};
