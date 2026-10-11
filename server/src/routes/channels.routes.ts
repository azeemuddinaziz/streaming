import { Router } from "express";
import { ChannelController } from "../controllers/channels.controller.ts";
import { SubscriptionController } from "../controllers/subscriptions.controller.ts";
import { AuthenticationMiddleware, OptionalAuthenticationMiddleware } from "../middlewares/auth.middleware.ts";

const router = Router();

router.get("/:name", OptionalAuthenticationMiddleware.identify, ChannelController.page);
router.put("/:name/subscription", AuthenticationMiddleware.verifyToken, SubscriptionController.subscribe);
router.delete("/:name/subscription", AuthenticationMiddleware.verifyToken, SubscriptionController.unsubscribe);

export default router;
