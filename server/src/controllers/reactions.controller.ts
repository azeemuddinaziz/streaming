import type { Request, Response } from "express";
import { ReactionService } from "../services/reactions.service.ts";

export const ReactionController = {
  async set(req: Request, res: Response) {
    const result = await ReactionService.set(req.user!.id, req.params.id as string, (req.body ?? {}).kind);
    res.status(200).json(result);
  },

  async remove(req: Request, res: Response) {
    res.status(200).json(await ReactionService.remove(req.user!.id, req.params.id as string));
  },

  async setOnComment(req: Request, res: Response) {
    const { id, commentId } = req.params as { id: string; commentId: string };
    res.status(200).json(await ReactionService.setOnComment(req.user!.id, id, commentId, (req.body ?? {}).kind));
  },

  async removeFromComment(req: Request, res: Response) {
    const { id, commentId } = req.params as { id: string; commentId: string };
    res.status(200).json(await ReactionService.removeFromComment(req.user!.id, id, commentId));
  },
};
