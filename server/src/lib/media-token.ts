import { jwtVerify, SignJWT } from "jose";

// A signed media address stays valid long enough to watch a long Video.
export const MEDIA_TOKEN_SECONDS = 6 * 60 * 60;

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(value);
}

// A token naming one Video, to put in the address of its playlists and
// segments. The audience keeps a sign-in token from working as one.
export async function signMediaToken(videoId: string, issuedAt = new Date()) {
  const issuedAtSeconds = Math.floor(issuedAt.getTime() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("media")
    .setSubject(videoId)
    .setIssuedAt(issuedAtSeconds)
    .setExpirationTime(issuedAtSeconds + MEDIA_TOKEN_SECONDS)
    .sign(secret());
}

// The Video the token is for, or undefined if it is forged or expired.
export async function verifyMediaToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
      audience: "media",
    });
    return payload.sub;
  } catch {
    return undefined;
  }
}
