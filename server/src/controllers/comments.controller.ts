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
    const { body: text, parentId } = req.body ?? {};
    const comment = await CommentService.create(req.user!.id, req.params.id as string, text, parentId);
    res.status(201).json({ comment });
  },

  async edit(req: Request, res: Response) {
    const comment = await CommentService.edit(
      req.user!.id,
      req.params.id as string,
      req.params.commentId as string,
      (req.body ?? {}).body,
    );
    res.status(200).json({ comment });
  },

  async remove(req: Request, res: Response) {
    await CommentService.remove(req.user!.id, req.params.id as string, req.params.commentId as string);
    res.status(204).end();
  },
};
