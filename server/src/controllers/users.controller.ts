import type { Request, Response } from "express";

export const UserController = {
  async get(req: Request, res: Response) {
    res.status(200).json({ msg: "Success" });
  },
};
