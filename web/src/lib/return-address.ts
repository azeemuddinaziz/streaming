// The return address of the account screens: `?next=<path>` brings a person
// back to where they were after signing in or up. Only a same-origin path is
// honoured, so the screens cannot be used to send someone to another site.

// `value` is a `next` query value (or anything); returns a safe path, else "/".
export function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/";
  // One leading slash, no second slash or backslash right after it, and no
  // control characters or whitespace anywhere (browsers strip tabs and
  // newlines inside URLs, which could turn "/\t/host" into "//host").
  if (!/^\/(?![/\\])[^\s\\\u0000-\u001f\u007f]*$/.test(value)) return "/";
  // Back to the sign-in screens would only loop.
  if (/^\/sign-(in|up)(?:[/?#]|$)/.test(value)) return "/";
  return value;
}

function withNext(screen: string, path: string): string {
  const next = safeNext(path);
  return next === "/" ? screen : `${screen}?next=${encodeURIComponent(next)}`;
}

export function signInHref(path: string): string {
  return withNext("/sign-in", path);
}

export function signUpHref(path: string): string {
  return withNext("/sign-up", path);
}
