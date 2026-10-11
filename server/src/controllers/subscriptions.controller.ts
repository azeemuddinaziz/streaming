import type { Request, Response } from "express";
import { SubscriptionService } from "../services/subscriptions.service.ts";

export const SubscriptionController = {
  async subscribe(req: Request, res: Response) {
    res.status(200).json(await SubscriptionService.subscribe(req.user!.id, req.params.name as string));
  },

  async list(req: Request, res: Response) {
    res.status(200).json(await SubscriptionService.list(req.user!.id, req.query.page));
  },

  async unsubscribe(req: Request, res: Response) {
    res.status(200).json(await SubscriptionService.unsubscribe(req.user!.id, req.params.name as string));
  },
};
