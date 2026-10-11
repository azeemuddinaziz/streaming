import { describe, expect, it } from "vitest";
import {
  bottomBarItems,
  isActive,
  isKeyboardOpen,
  isWatchPath,
  parseSidebarCookie,
  sidebarCookie,
  sidebarItems,
} from "./nav";

describe("isActive", () => {
  it("matches Home only on the root", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/studio", "/")).toBe(false);
  });

  it("matches a destination and the pages beneath it, not a lookalike", () => {
    expect(isActive("/studio", "/studio")).toBe(true);
    expect(isActive("/studio/videos/1", "/studio")).toBe(true);
    expect(isActive("/studio-x", "/studio")).toBe(false);
  });
});

describe("isWatchPath", () => {
  it("is true for a watch page only", () => {
    expect(isWatchPath("/watch/abc")).toBe(true);
    expect(isWatchPath("/watching")).toBe(false);
    expect(isWatchPath("/")).toBe(false);
  });
});

describe("sidebar cookie", () => {
  it("reads collapsed, and treats anything else as expanded", () => {
    expect(parseSidebarCookie("collapsed")).toBe(true);
    expect(parseSidebarCookie("expanded")).toBe(false);
    expect(parseSidebarCookie(undefined)).toBe(false);
  });

  it("writes a year-long, site-wide cookie", () => {
    expect(sidebarCookie(true)).toBe("sidebar=collapsed; path=/; max-age=31536000; samesite=lax");
    expect(sidebarCookie(false)).toContain("sidebar=expanded");
  });
});

describe("destinations", () => {
  it("shows Home, Subscriptions and Studio in the sidebar when signed in", () => {
    expect(sidebarItems(true).map((i) => i.label)).toEqual(["Home", "Subscriptions", "Studio"]);
  });

  it("hides, not disables, Subscriptions and Studio when signed out", () => {
    expect(sidebarItems(false).map((i) => i.label)).toEqual(["Home"]);
  });

  it("puts an emphasised Upload in the middle of the signed-in bottom bar", () => {
    const items = bottomBarItems(true);
    expect(items.map((i) => i.label)).toEqual(["Home", "Subscriptions", "Upload", "Studio"]);
    expect(items.filter((i) => i.emphasised).map((i) => i.label)).toEqual(["Upload"]);
  });

  it("offers Home and Sign in in the signed-out bottom bar", () => {
    expect(bottomBarItems(false).map((i) => i.label)).toEqual(["Home", "Sign in"]);
  });
});

describe("isKeyboardOpen", () => {
  it("is true when the visual viewport shrinks well below the layout height", () => {
    expect(isKeyboardOpen(400, 800)).toBe(true);
  });

  it("is false for small changes such as a collapsing browser toolbar", () => {
    expect(isKeyboardOpen(740, 800)).toBe(false);
  });
});
