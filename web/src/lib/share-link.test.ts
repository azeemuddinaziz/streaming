import { describe, expect, it } from "vitest";
import { buildShareLink, formatTimestamp, parseStartTime, startPosition } from "./share-link";

describe("buildShareLink", () => {
  it("is the origin plus the path, with no t by default", () => {
    expect(buildShareLink("https://streamsouk.test", "/watch/abc")).toBe("https://streamsouk.test/watch/abc");
  });

  it("adds t as whole seconds when given", () => {
    expect(buildShareLink("https://streamsouk.test", "/watch/abc", 83.9)).toBe(
      "https://streamsouk.test/watch/abc?t=83",
    );
  });

  it("leaves t out for 0, negative and non-finite values", () => {
    for (const t of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, undefined]) {
      expect(buildShareLink("https://streamsouk.test", "/watch/abc", t)).toBe("https://streamsouk.test/watch/abc");
    }
  });
});

describe("parseStartTime", () => {
  it("reads a whole number of seconds", () => {
    expect(parseStartTime("?t=83")).toBe(83);
    expect(parseStartTime("t=0")).toBe(0);
  });

  it("ignores missing, empty, negative, fractional and non-numeric values", () => {
    for (const search of ["", "?t=", "?t=-4", "?t=1.5", "?t=abc", "?t=1e3", "?t=12s", "?t=%20", "?x=3"]) {
      expect(parseStartTime(search)).toBeNull();
    }
  });

  it("ignores values too large to be a real position", () => {
    expect(parseStartTime("?t=99999999999999999999")).toBeNull();
  });
});

describe("startPosition", () => {
  it("seeks to a value inside the Video", () => {
    expect(startPosition(83, 600)).toBe(83);
  });

  it("plays from the start when there is no value or it is past the end", () => {
    expect(startPosition(null, 600)).toBeNull();
    expect(startPosition(600, 600)).toBeNull();
    expect(startPosition(900, 600)).toBeNull();
    expect(startPosition(5, Number.NaN)).toBeNull();
  });
});

describe("formatTimestamp", () => {
  it("formats minutes and seconds, and hours when needed", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(83)).toBe("1:23");
    expect(formatTimestamp(3725)).toBe("1:02:05");
  });
});
