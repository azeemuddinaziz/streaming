import { Router } from "express";
import { UploadController } from "../controllers/uploads.controller.ts";
import { AuthenticationMiddleware } from "../middlewares/auth.middleware.ts";

const router = Router();

router.get(
  "/unfinished",
  AuthenticationMiddleware.verifyToken,
  UploadController.unfinished,
);

export default router;
