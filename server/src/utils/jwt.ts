import { jwtVerify, SignJWT } from "jose";

// A sign-in lasts 30 days from its last use: the authentication middleware
// issues a fresh token once the current one is a day old.
export const TOKEN_LIFETIME_SECONDS = 30 * 24 * 60 * 60;
export const TOKEN_RENEW_AFTER_SECONDS = 24 * 60 * 60;

export function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(value);
}

export async function signToken(userId: string, issuedAt = new Date()) {
  const issuedAtSeconds = Math.floor(issuedAt.getTime() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt(issuedAtSeconds)
    .setExpirationTime(issuedAtSeconds + TOKEN_LIFETIME_SECONDS)
    .sign(secret());
}

// Returns who the token is for and when it was issued, or undefined if the
// token is malformed, forged or expired.
export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
    });
    // Tokens made for something else (media addresses) are not sign-ins.
    if (!payload.sub || !payload.iat || payload.aud) return undefined;

    return { userId: payload.sub, issuedAt: payload.iat };
  } catch {
    return undefined;
  }
}
