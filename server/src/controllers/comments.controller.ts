import type { Request, Response } from "express";
import { CommentService } from "../services/comments.service.ts";

export const CommentController = {
  async list(req: Request, res: Response) {
    res.status(200).json(await CommentService.list(req.user?.id, req.params.id as string, req.query.page));
  },

  async replies(req: Request, res: Response) {
    const result = await CommentService.listReplies(
      req.user?.id,
      req.params.id as string,
      req.params.commentId as string,
    );
    res.status(200).json(result);
  },

  async create(req: Request, res: Response) {
    const body = req.body ?? {};
    const comment = await CommentService.create(req.user!.id, req.params.id as string, body.body, body.parentId);
    res.status(201).json({ comment });
  },
};
