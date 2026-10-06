import type { NextFunction, Request, Response } from "express";
import { UserRepository } from "../repositories/users.repository.ts";
import { setTokenCookie, TOKEN_COOKIE } from "../utils/cookie.ts";
import {
  signToken,
  TOKEN_RENEW_AFTER_SECONDS,
  verifyToken,
} from "../utils/jwt.ts";

// The token comes from an "Authorization: Bearer <token>" header (used by the
// upload server) or, for the web app, the sign-in cookie.
function readToken(req: Request) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return { token: header.slice("Bearer ".length), fromCookie: false };
  }

  const cookie = req.cookies?.[TOKEN_COOKIE];
  return typeof cookie === "string"
    ? { token: cookie, fromCookie: true }
    : undefined;
}

export class AuthenticationMiddleware {
  static verifyToken = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const unauthenticated = () =>
      res.status(401).json({ msg: "User not Authenticated." });

    const found = readToken(req);
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

    req.user = { id: user.id, email: user.email, name: user.name };
    req.channel = { id: user.channel.id, name: user.name };
    next();
  };
}

export class AuthorizationMiddleware {
  static role = () => {};
}
