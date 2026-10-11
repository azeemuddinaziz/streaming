import { Router } from "express";
import { SubscriptionController } from "../controllers/subscriptions.controller.ts";
import { UserController } from "../controllers/users.controller.ts";
import { AuthenticationMiddleware } from "../middlewares/auth.middleware.ts";

const router = Router();

router.post("/sign-up", UserController.signUp);
router.post("/sign-in", UserController.signIn);
router.post("/sign-out", UserController.signOut);

router.get("/me", AuthenticationMiddleware.verifyToken, UserController.me);
router.get("/me/subscriptions", AuthenticationMiddleware.verifyToken, SubscriptionController.list);

export default router;
