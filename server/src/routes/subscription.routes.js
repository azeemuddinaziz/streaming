import { Router } from "express";
import {
  getSubscribedChannels,
  getUserChannelSubscribers,
  toggleSubscription,
} from "../controllers/subscription.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/subscribersList/:channelId").get(getUserChannelSubscribers);
router.route("/channelList/:subscriberId").get(getSubscribedChannels);

//secured routes
router.route("/subscribe/:channelId").post(verifyJWT, toggleSubscription);

export default router;
