import { Router } from "express";
import { VideoController } from "../controllers/videos.controller.ts";

const router = Router();

router.get("/", VideoController.get);
router.post("/", VideoController.create);

export default router;
