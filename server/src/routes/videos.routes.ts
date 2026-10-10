import express, { Router } from "express";
import { THUMBNAIL_MAX_BYTES } from "../lib/thumbnail.ts";
import { AuthenticationMiddleware, OptionalAuthenticationMiddleware } from "../middlewares/auth.middleware.ts";
import { CommentController } from "../controllers/comments.controller.ts";
import { VideoController } from "../controllers/videos.controller.ts";

const router = Router();

router.get("/mine", AuthenticationMiddleware.verifyToken, VideoController.mine);
router.get("/:id/watch", OptionalAuthenticationMiddleware.identify, VideoController.watch);
router.post("/:id/views", OptionalAuthenticationMiddleware.identify, VideoController.view);
router.get("/:id/comments/hidden", AuthenticationMiddleware.verifyToken, CommentController.hidden);
router.post("/:id/comments/:commentId/hide", AuthenticationMiddleware.verifyToken, CommentController.hide);
router.post("/:id/comments/:commentId/unhide", AuthenticationMiddleware.verifyToken, CommentController.unhide);
router.get("/:id/comments", OptionalAuthenticationMiddleware.identify, CommentController.list);
router.get(
  "/:id/comments/:commentId/replies",
  OptionalAuthenticationMiddleware.identify,
  CommentController.replies,
);
router.post("/:id/comments", AuthenticationMiddleware.verifyToken, CommentController.create);
router.patch("/:id/comments/:commentId", AuthenticationMiddleware.verifyToken, CommentController.edit);
router.delete("/:id/comments/:commentId", AuthenticationMiddleware.verifyToken, CommentController.remove);
router.patch("/:id", AuthenticationMiddleware.verifyToken, VideoController.update);
router.delete("/:id", AuthenticationMiddleware.verifyToken, VideoController.remove);
router.put(
  "/:id/thumbnail",
  AuthenticationMiddleware.verifyToken,
  express.raw({ type: "image/*", limit: THUMBNAIL_MAX_BYTES }),
  VideoController.replaceThumbnail,
);
router.post("/:id/retry", AuthenticationMiddleware.verifyToken, VideoController.retry);
router.get("/", VideoController.get);
router.post("/", VideoController.create);

export default router;
