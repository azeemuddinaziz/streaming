import { Router } from "express";
import { AuthenticationMiddleware } from "../middlewares/auth.middleware.ts";
import { VideoController } from "../controllers/videos.controller.ts";

const router = Router();

router.get("/mine", AuthenticationMiddleware.verifyToken, VideoController.mine);
router.post("/:id/retry", AuthenticationMiddleware.verifyToken, VideoController.retry);
router.get("/", VideoController.get);
router.post("/", VideoController.create);

export default router;
