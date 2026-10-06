import type { CookieOptions, Response } from "express";
import { TOKEN_LIFETIME_SECONDS } from "./jwt.ts";

export const TOKEN_COOKIE = "token";

function options(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: "/",
  };
}

export function setTokenCookie(res: Response, token: string) {
  res.cookie(TOKEN_COOKIE, token, {
    ...options(),
    maxAge: TOKEN_LIFETIME_SECONDS * 1000,
  });
}

export function clearTokenCookie(res: Response) {
  res.clearCookie(TOKEN_COOKIE, options());
}
