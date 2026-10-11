// A Share link is only an address (GLOSSARY, Share link): these helpers build
// it and read back its optional start time. Nothing here records anything.

// The page's address, with `?t=<whole seconds>` only when a start time is given.
export function buildShareLink(origin: string, path: string, startAt?: number): string {
  const link = `${origin}${path}`;
  if (startAt === undefined || !Number.isFinite(startAt) || startAt < 1) return link;
  return `${link}?t=${Math.floor(startAt)}`;
}

// The `t` of a query string as whole seconds, or null when it is missing or not
// a plain non-negative integer.
export function parseStartTime(search: string): number | null {
  const value = new URLSearchParams(search).get("t");
  if (value === null || !/^\d{1,9}$/.test(value)) return null;
  return Number(value);
}

// Where to seek once the Video's length is known: a start time at or past the
// end plays from the start, as does an unknown length.
export function startPosition(startAt: number | null, duration: number): number | null {
  if (startAt === null || !Number.isFinite(duration) || startAt >= duration) return null;
  return startAt;
}

export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
