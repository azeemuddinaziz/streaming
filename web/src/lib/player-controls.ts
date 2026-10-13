// Seconds the J / L keys and an outer-third double tap move.
export const LONG_SEEK = 10;

// The hls.js level that means "choose by bandwidth".
export const AUTO_LEVEL = -1;

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export type ShortcutAction =
  | { type: "toggle" }
  | { type: "seek"; by: number }
  | { type: "volume"; by: number }
  | { type: "mute" }
  | { type: "fullscreen" }
  | { type: "theater" }
  | { type: "pip" }
  | { type: "jump"; fraction: number }
  | { type: "speed"; direction: 1 | -1 }
  | { type: "help" };

// What the shortcuts help dialog lists; keep in step with `shortcutFor`.
export const SHORTCUTS: { keys: string; does: string }[] = [
  { keys: "Space or K", does: "Play or pause" },
  { keys: "J / L", does: "Back or forward 10 seconds" },
  { keys: "← / →", does: "Back or forward 5 seconds" },
  { keys: "↑ / ↓", does: "Volume up or down" },
  { keys: "M", does: "Mute or unmute" },
  { keys: "< / >", does: "Slower or faster" },
  { keys: "0 to 9", does: "Jump to 0% to 90% of the video" },
  { keys: "Home / End", does: "Start or end of the video" },
  { keys: "T", does: "Theater mode" },
  { keys: "I", does: "Picture-in-picture" },
  { keys: "F", does: "Fullscreen" },
  { keys: "?", does: "Show these shortcuts" },
];

export function formatTime(seconds: number): string {
  const whole = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = String(whole % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function stepSpeed(current: number, direction: 1 | -1): number {
  const next =
    direction === 1 ? SPEEDS.find((s) => s > current) : [...SPEEDS].reverse().find((s) => s < current);
  return next ?? (direction === 1 ? SPEEDS[SPEEDS.length - 1] : SPEEDS[0]);
}

export function qualityLabel(height: number): string {
  return `${height}p`;
}

export function shortcutFor(
  key: string,
  mods: { ctrl?: boolean; meta?: boolean; alt?: boolean },
): ShortcutAction | null {
  if (mods.ctrl || mods.meta || mods.alt) return null;
  switch (key) {
    case " ":
    case "k":
    case "K":
      return { type: "toggle" };
    case "j":
    case "J":
      return { type: "seek", by: -LONG_SEEK };
    case "l":
    case "L":
      return { type: "seek", by: LONG_SEEK };
    case "ArrowLeft":
      return { type: "seek", by: -5 };
    case "ArrowRight":
      return { type: "seek", by: 5 };
    case "ArrowUp":
      return { type: "volume", by: 0.05 };
    case "ArrowDown":
      return { type: "volume", by: -0.05 };
    case "m":
    case "M":
      return { type: "mute" };
    case "f":
    case "F":
      return { type: "fullscreen" };
    case "t":
    case "T":
      return { type: "theater" };
    case "i":
    case "I":
      return { type: "pip" };
    case "Home":
      return { type: "jump", fraction: 0 };
    case "End":
      return { type: "jump", fraction: 1 };
    case ">":
      return { type: "speed", direction: 1 };
    case "<":
      return { type: "speed", direction: -1 };
    case "?":
      return { type: "help" };
  }
  if (/^[0-9]$/.test(key)) return { type: "jump", fraction: Number(key) / 10 };
  return null;
}

// Which third of the frame a tap landed in: the outer thirds seek on a double tap.
export function tapZone(x: number, width: number): "back" | "middle" | "forward" {
  if (width <= 0) return "middle";
  const fraction = x / width;
  if (fraction < 1 / 3) return "back";
  if (fraction > 2 / 3) return "forward";
  return "middle";
}
