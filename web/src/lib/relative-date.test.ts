import { describe, expect, it } from "vitest";
import { relativeDate } from "./relative-date";

const now = new Date("2026-10-11T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

describe("relativeDate", () => {
  it("says just now under a minute and for the future", () => {
    expect(relativeDate(ago(30_000), now)).toBe("just now");
    expect(relativeDate(ago(-5 * MIN), now)).toBe("just now");
  });
  it("counts minutes, hours, days, weeks, months and years", () => {
    expect(relativeDate(ago(5 * MIN), now)).toBe("5 minutes ago");
    expect(relativeDate(ago(60 * MIN), now)).toBe("1 hour ago");
    expect(relativeDate(ago(3 * DAY), now)).toBe("3 days ago");
    expect(relativeDate(ago(14 * DAY), now)).toBe("2 weeks ago");
    expect(relativeDate(ago(60 * DAY), now)).toBe("2 months ago");
    expect(relativeDate(ago(800 * DAY), now)).toBe("2 years ago");
  });
  it("falls back to just now for an unreadable date", () => {
    expect(relativeDate("nope", now)).toBe("just now");
  });
});
