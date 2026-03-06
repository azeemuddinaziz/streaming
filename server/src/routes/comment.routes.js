import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  addComment,
  deleteComment,
  getVideoComments,
  updateComment,
} from "../controllers/comment.controller.js";

const router = Router();

router.route("/getVideoComments/:videoId").get(getVideoComments);

//secured routes
router.route("/add/:videoId").post(verifyJWT, addComment);
router.route("/update/:commentId").patch(verifyJWT, updateComment);
router.route("/delete/:commentId").delete(verifyJWT, deleteComment);

export default router;
