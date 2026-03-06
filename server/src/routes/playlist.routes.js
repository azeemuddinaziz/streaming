import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  addVideoToPlaylist,
  createPlaylist,
  deletePlaylist,
  getPlaylistById,
  getUserPlaylists,
  removeVideoFromPlaylist,
  updatePlaylist,
} from "../controllers/playlist.contoller.js";

const router = Router();

router.route("/getUsersPlaylists/:userId").get(getUserPlaylists);
router.route("/getPlaylistById/:playlistId").get(getPlaylistById);

//secured routes
router.route("/create").post(verifyJWT, createPlaylist);

router
  .route("/addVideo/:playlistId/:videoId")
  .patch(verifyJWT, addVideoToPlaylist);
router
  .route("/removeVideo/:playlistId/:videoId")
  .patch(verifyJWT, removeVideoFromPlaylist);

router.route("/deletePlaylist/:playlistId").delete(verifyJWT, deletePlaylist);
router.route("/updatePlaylist/:playlistId").patch(verifyJWT, updatePlaylist);

export default router;
