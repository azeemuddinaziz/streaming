import { Router } from "express";
import { UploadController } from "../../controllers/upload.controller";
import { protect } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { wideEventMiddleware } from "../../middlewares/wideEvent.middleware";
import { createUploadIntentSchema } from "../../schema/upload.schema";

const router = Router();
const controller = new UploadController();

router.use(wideEventMiddleware());

router.post(
  "/intent",
  protect,
  validate(createUploadIntentSchema),
  controller.createIntent,
);

export const uploadRouter = router;
