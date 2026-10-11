import { describe, expect, it } from "vitest";
import {
  DESCRIPTION_MAX,
  TITLE_MAX,
  fieldForMessage,
  guardedHref,
  isDirty,
  visibilityRule,
} from "./video-details";

describe("visibilityRule", () => {
  it("lets Private through always", () => {
    expect(visibilityRule({ title: "", description: "" }).PRIVATE).toEqual({ allowed: true });
  });

  it("holds Unlisted and Public back until both a title and a description are filled", () => {
    for (const visibility of ["UNLISTED", "PUBLIC"] as const) {
      expect(visibilityRule({ title: "", description: "" })[visibility]).toEqual({
        allowed: false,
        reason: "Add a title and a description first.",
      });
      expect(visibilityRule({ title: "Holiday", description: "" })[visibility]).toEqual({
        allowed: false,
        reason: "Add a description first.",
      });
      expect(visibilityRule({ title: "  ", description: "Two weeks" })[visibility]).toEqual({
        allowed: false,
        reason: "Add a title first.",
      });
      expect(visibilityRule({ title: "Holiday", description: "Two weeks" })[visibility]).toEqual({ allowed: true });
    }
  });
});

describe("isDirty", () => {
  const saved = { title: "Holiday", description: "Two weeks", visibility: "PUBLIC", commentsEnabled: true } as const;

  it("is clean for the saved values and for edits that save as the same text", () => {
    expect(isDirty(saved, { ...saved })).toBe(false);
    expect(isDirty(saved, { ...saved, title: "  Holiday  " })).toBe(false);
  });

  it("is dirty when any field differs", () => {
    expect(isDirty(saved, { ...saved, title: "Holidays" })).toBe(true);
    expect(isDirty(saved, { ...saved, description: "" })).toBe(true);
    expect(isDirty(saved, { ...saved, visibility: "PRIVATE" })).toBe(true);
    expect(isDirty(saved, { ...saved, commentsEnabled: false })).toBe(true);
  });
});

describe("fieldForMessage", () => {
  it("maps the API's refusals to the field they are about", () => {
    expect(fieldForMessage(`The title can be at most ${TITLE_MAX} characters.`)).toBe("title");
    expect(fieldForMessage(`The description can be at most ${DESCRIPTION_MAX} characters.`)).toBe("description");
    expect(fieldForMessage("Add a title and a description before making a video unlisted or public.")).toBe(
      "visibility",
    );
    expect(fieldForMessage("Visibility must be PRIVATE, UNLISTED or PUBLIC.")).toBe("visibility");
    expect(fieldForMessage("Something went wrong.")).toBeNull();
  });
});

describe("guardedHref", () => {
  const here = "http://localhost:3001/studio/videos/abc";
  const click = (href: string, extra: Partial<Parameters<typeof guardedHref>[0]> = {}) =>
    guardedHref({ href, button: 0, ...extra }, here);

  it("returns the path of a same-origin link to another page", () => {
    expect(click("/studio?page=2")).toBe("/studio?page=2");
    expect(click("http://localhost:3001/watch/abc#x")).toBe("/watch/abc#x");
  });

  it("leaves alone what the browser or the page handles itself", () => {
    expect(click("/studio/videos/abc")).toBeNull();
    expect(click("#details")).toBeNull();
    expect(click("https://example.com/")).toBeNull();
    expect(click("/watch/abc", { ctrlKey: true })).toBeNull();
    expect(click("/watch/abc", { metaKey: true })).toBeNull();
    expect(click("/watch/abc", { shiftKey: true })).toBeNull();
    expect(click("/watch/abc", { button: 1 })).toBeNull();
    expect(click("/watch/abc", { target: "_blank" })).toBeNull();
    expect(click("/files/x.zip", { download: true })).toBeNull();
  });
});
