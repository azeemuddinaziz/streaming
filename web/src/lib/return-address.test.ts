import { describe, expect, it } from "vitest";
import { safeNext, signInHref, signUpHref } from "./return-address";

describe("safeNext", () => {
  it("accepts a same-origin path, with its query", () => {
    expect(safeNext("/watch/abc")).toBe("/watch/abc");
    expect(safeNext("/watch/abc?t=90")).toBe("/watch/abc?t=90");
    expect(safeNext("/")).toBe("/");
  });

  it.each([
    "https://evil.example/x",
    "http://evil.example",
    "//evil.example",
    "///evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "watch/abc",
    "",
    " /watch/abc",
    "/watch/abc\n",
    "/\tevil.example",
  ])("falls back to / for %j", (value) => {
    expect(safeNext(value)).toBe("/");
  });

  it("falls back to / for missing or non-string values", () => {
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext(null)).toBe("/");
    expect(safeNext(["/a", "/b"])).toBe("/");
  });

  it("does not return to the sign-in screens themselves", () => {
    expect(safeNext("/sign-in?next=/studio")).toBe("/");
    expect(safeNext("/sign-up")).toBe("/");
  });
});

describe("signInHref and signUpHref", () => {
  it("carry the encoded path as next", () => {
    expect(signInHref("/watch/abc?t=5")).toBe("/sign-in?next=%2Fwatch%2Fabc%3Ft%3D5");
    expect(signUpHref("/studio")).toBe("/sign-up?next=%2Fstudio");
  });

  it("leave next out for the home page or an unsafe path", () => {
    expect(signInHref("/")).toBe("/sign-in");
    expect(signInHref("//evil.example")).toBe("/sign-in");
  });
});
