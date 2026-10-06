import type { NextFunction, Request, Response } from "express";

export class AuthenticationMiddleware {
  static verifyToken = (req: Request, res: Response, next: NextFunction) => {
    console.log(req.cookies.token);
    const token = req.headers["authorization"] || req.cookies["token"];

    if (!token) {
      return res.send(401).json({ msg: "User not Authenticated." });
    }

    req.user = token;

    next();
  };
}

export class AuthorizationMiddleware {
  static role = () => {};
}
