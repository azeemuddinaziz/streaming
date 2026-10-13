import { describe, expect, it } from "vitest";
import { clamp, formatTime, qualityLabel, shortcutFor, stepSpeed, tapZone } from "./player-controls";

describe("formatTime", () => {
  it("writes minutes and seconds, adding hours only when needed", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(83.7)).toBe("1:23");
    expect(formatTime(3723)).toBe("1:02:03");
  });
  it("treats unknown and negative values as zero", () => {
    expect(formatTime(Number.NaN)).toBe("0:00");
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe("0:00");
    expect(formatTime(-5)).toBe("0:00");
  });
});

describe("clamp", () => {
  it("keeps a value within bounds", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});

describe("stepSpeed", () => {
  it("moves to the next listed speed and stops at the ends", () => {
    expect(stepSpeed(1, 1)).toBe(1.25);
    expect(stepSpeed(1, -1)).toBe(0.75);
    expect(stepSpeed(2, 1)).toBe(2);
    expect(stepSpeed(0.5, -1)).toBe(0.5);
  });
  it("snaps an unlisted speed to its neighbour in the direction asked", () => {
    expect(stepSpeed(1.1, 1)).toBe(1.25);
    expect(stepSpeed(1.1, -1)).toBe(1);
  });
});

describe("qualityLabel", () => {
  it("names a rendition by its height", () => {
    expect(qualityLabel(720)).toBe("720p");
  });
});

describe("shortcutFor", () => {
  it("maps the YouTube-style keys", () => {
    expect(shortcutFor("k", {})).toEqual({ type: "toggle" });
    expect(shortcutFor(" ", {})).toEqual({ type: "toggle" });
    expect(shortcutFor("j", {})).toEqual({ type: "seek", by: -10 });
    expect(shortcutFor("l", {})).toEqual({ type: "seek", by: 10 });
    expect(shortcutFor("ArrowLeft", {})).toEqual({ type: "seek", by: -5 });
    expect(shortcutFor("ArrowRight", {})).toEqual({ type: "seek", by: 5 });
    expect(shortcutFor("ArrowUp", {})).toEqual({ type: "volume", by: 0.05 });
    expect(shortcutFor("ArrowDown", {})).toEqual({ type: "volume", by: -0.05 });
    expect(shortcutFor("m", {})).toEqual({ type: "mute" });
    expect(shortcutFor("f", {})).toEqual({ type: "fullscreen" });
    expect(shortcutFor("t", {})).toEqual({ type: "theater" });
    expect(shortcutFor("i", {})).toEqual({ type: "pip" });
    expect(shortcutFor("Home", {})).toEqual({ type: "jump", fraction: 0 });
    expect(shortcutFor("End", {})).toEqual({ type: "jump", fraction: 1 });
    expect(shortcutFor("4", {})).toEqual({ type: "jump", fraction: 0.4 });
    expect(shortcutFor(">", { shift: true })).toEqual({ type: "speed", direction: 1 });
    expect(shortcutFor("<", { shift: true })).toEqual({ type: "speed", direction: -1 });
    expect(shortcutFor("?", { shift: true })).toEqual({ type: "help" });
  });
  it("is case-insensitive for letters", () => {
    expect(shortcutFor("K", { shift: true })).toEqual({ type: "toggle" });
  });
  it("leaves browser shortcuts and unknown keys alone", () => {
    expect(shortcutFor("f", { ctrl: true })).toBeNull();
    expect(shortcutFor("l", { meta: true })).toBeNull();
    expect(shortcutFor("ArrowLeft", { alt: true })).toBeNull();
    expect(shortcutFor("q", {})).toBeNull();
  });
});

describe("tapZone", () => {
  it("splits the frame into thirds", () => {
    expect(tapZone(10, 300)).toBe("back");
    expect(tapZone(150, 300)).toBe("middle");
    expect(tapZone(290, 300)).toBe("forward");
  });
  it("is the middle for a frame with no width", () => {
    expect(tapZone(0, 0)).toBe("middle");
  });
});
