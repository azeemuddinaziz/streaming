import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  getLikedVideos,
  toggleCommentLike,
  toggleTweetLike,
  toggleVideoLike,
} from "../controllers/like.controller.js";

const router = Router();

//secured routes
router.route("/toggleLikeVideo/:videoId").post(verifyJWT, toggleVideoLike);
router
  .route("/toggleLikeComment/:commentId")
  .post(verifyJWT, toggleCommentLike);
router.route("/toggleLikeTweet/:tweetId").post(verifyJWT, toggleTweetLike);
router.route("/getLikedVideos/").get(verifyJWT, getLikedVideos);

export default router;
