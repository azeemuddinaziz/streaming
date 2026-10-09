import { Router } from "express";
import { AuthenticationMiddleware, OptionalAuthenticationMiddleware } from "../middlewares/auth.middleware.ts";
import { VideoController } from "../controllers/videos.controller.ts";

const router = Router();

router.get("/mine", AuthenticationMiddleware.verifyToken, VideoController.mine);
router.get("/:id/watch", OptionalAuthenticationMiddleware.identify, VideoController.watch);
router.patch("/:id", AuthenticationMiddleware.verifyToken, VideoController.update);
router.delete("/:id", AuthenticationMiddleware.verifyToken, VideoController.remove);
router.post("/:id/retry", AuthenticationMiddleware.verifyToken, VideoController.retry);
router.get("/", VideoController.get);
router.post("/", VideoController.create);

export default router;
