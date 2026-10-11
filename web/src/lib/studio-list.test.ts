import { describe, expect, it } from "vitest";
import { lastPage, pageItems, parseStudioQuery, studioHref } from "./studio-list";

describe("parseStudioQuery", () => {
  it("reads a page and a status from the address", () => {
    expect(parseStudioQuery({ page: "3", status: "failed" })).toEqual({ page: 3, status: "FAILED" });
  });

  it("falls back to page 1 and no filter for anything else", () => {
    expect(parseStudioQuery({})).toEqual({ page: 1, status: undefined });
    expect(parseStudioQuery({ page: "0", status: "nope" })).toEqual({ page: 1, status: undefined });
    expect(parseStudioQuery({ page: "2.5" })).toEqual({ page: 1, status: undefined });
    expect(parseStudioQuery({ page: ["2", "3"], status: ["ready", "failed"] })).toEqual({
      page: 1,
      status: undefined,
    });
  });
});

describe("studioHref", () => {
  it("leaves out what is the default", () => {
    expect(studioHref({ page: 1, status: undefined })).toBe("/studio");
    expect(studioHref({ page: 2, status: undefined })).toBe("/studio?page=2");
    expect(studioHref({ page: 1, status: "READY" })).toBe("/studio?status=ready");
    expect(studioHref({ page: 3, status: "FAILED" })).toBe("/studio?status=failed&page=3");
  });
});

describe("lastPage", () => {
  it("is at least 1 and counts 24 to a page", () => {
    expect(lastPage(0)).toBe(1);
    expect(lastPage(24)).toBe(1);
    expect(lastPage(25)).toBe(2);
  });
});

describe("pageItems", () => {
  it("lists every page when there are few", () => {
    expect(pageItems(1, 3)).toEqual([1, 2, 3]);
  });

  it("keeps the ends and the neighbours, with gaps", () => {
    expect(pageItems(1, 10)).toEqual([1, 2, "gap", 10]);
    expect(pageItems(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10]);
    expect(pageItems(10, 10)).toEqual([1, "gap", 9, 10]);
    expect(pageItems(3, 10)).toEqual([1, 2, 3, 4, "gap", 10]);
  });
});
