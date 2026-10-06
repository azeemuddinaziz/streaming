import { Router } from "express";
import { WebhooksController } from "../controllers/webhooks.controller.ts";

const router = Router();

router.post("/tusd", WebhooksController.tusd);

export default router;
