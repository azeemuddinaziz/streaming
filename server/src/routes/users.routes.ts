import { Router } from "express";
import { AuthenticationMiddleware } from "../middlewares/auth.middleware.ts";

const router = Router();

router.get("/me", AuthenticationMiddleware.verifyToken, (req, res) => {
  return res.status(200).json({ msg: "success", user: req.user });
});

export default router;
