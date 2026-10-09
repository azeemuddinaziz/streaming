import { Router } from "express";
import { ChannelController } from "../controllers/channels.controller.ts";

const router = Router();

router.get("/:name", ChannelController.page);

export default router;
