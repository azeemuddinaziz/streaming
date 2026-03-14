import { Router } from "express";
import { AuthController } from "../../controllers/auth.controller";
import { validate } from "../../middlewares/validate.middleware";
import { wideEventMiddleware } from "../../middlewares/wideEvent.middleware";
import { loginSchema, registerSchema } from "../../schema/auth.schema";

const router = Router();
const controller = new AuthController();

router.use(wideEventMiddleware());

router.post("/register", validate(registerSchema), controller.register);
router.post("/login", validate(loginSchema), controller.login);

export const authRouter = router;
