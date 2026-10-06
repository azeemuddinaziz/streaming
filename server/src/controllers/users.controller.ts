import type { Request, Response } from "express";
import { AuthService } from "../services/auth.service.ts";
import { clearTokenCookie, setTokenCookie } from "../utils/cookie.ts";

export const UserController = {
  async get(req: Request, res: Response) {
    res.status(200).json({ msg: "Success" });
  },

  async me(req: Request, res: Response) {
    return res.status(200).json({ user: req.user, channel: req.channel });
  },

  async signUp(req: Request, res: Response) {
    const { token, user, channel } = await AuthService.signUp(req.body);

    setTokenCookie(res, token);
    return res.status(201).json({ user, channel });
  },

  async signIn(req: Request, res: Response) {
    const { token, user, channel } = await AuthService.signIn(req.body);

    setTokenCookie(res, token);
    return res.status(200).json({ user, channel });
  },

  async signOut(req: Request, res: Response) {
    clearTokenCookie(res);
    return res.status(204).end();
  },
};
