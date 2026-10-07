import type { NextFunction, Request, Response } from "express";
import { UserRepository } from "../repositories/users.repository.ts";
import { toAccount } from "../utils/account.ts";
import { setTokenCookie } from "../utils/cookie.ts";
import {
  signToken,
  TOKEN_RENEW_AFTER_SECONDS,
  verifyToken,
} from "../utils/jwt.ts";
import { pickToken } from "../utils/request-token.ts";

export class AuthenticationMiddleware {
  static verifyToken = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const unauthenticated = () =>
      res.status(401).json({ msg: "User not Authenticated." });

    const found = pickToken(req.headers.authorization, req.headers.cookie);
    if (!found) return unauthenticated();

    const verified = await verifyToken(found.token);
    if (!verified) return unauthenticated();

    const user = await UserRepository.findByIdWithChannel(verified.userId);
    if (!user?.channel) return unauthenticated();

    // Keep an active person signed in: swap an older cookie for a fresh one.
    const ageSeconds = Date.now() / 1000 - verified.issuedAt;
    if (found.fromCookie && ageSeconds > TOKEN_RENEW_AFTER_SECONDS) {
      setTokenCookie(res, await signToken(user.id));
    }

    const account = toAccount(user);
    req.user = account.user;
    req.channel = account.channel;
    next();
  };
}

export class AuthorizationMiddleware {
  static role = () => {};
}
