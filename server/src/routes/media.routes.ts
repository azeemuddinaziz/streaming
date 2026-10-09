import { Router } from "express";
import { MediaController } from "../controllers/media.controller.ts";

const router = Router();

router.get("/:token/*path", MediaController.serve);

export default router;
