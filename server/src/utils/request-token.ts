import { TOKEN_COOKIE } from "./cookie.ts";

// Picks the sign-in token out of an Authorization header ("Bearer <token>") or
// a Cookie header. Used for requests to the API and for hooks from the upload
// server, which forwards the browser's headers.
export function pickToken(authorization?: string, cookieHeader?: string) {
  const bearer = /^Bearer (.+)$/i.exec(authorization ?? "");
  if (bearer) {
    return { token: bearer[1]!, fromCookie: false };
  }

  for (const pair of (cookieHeader ?? "").split(";")) {
    const separator = pair.indexOf("=");
    if (separator !== -1 && pair.slice(0, separator).trim() === TOKEN_COOKIE) {
      return { token: pair.slice(separator + 1).trim(), fromCookie: true };
    }
  }
  return undefined;
}
