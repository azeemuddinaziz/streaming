import { describe, expect, it } from "vitest";
import { pickSuggestions, SUGGESTION_LIMIT } from "./suggested-videos";

const videos = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `v${i + 1}` }));
const ids = (list: { id: string }[]) => list.map((v) => v.id);

describe("pickSuggestions", () => {
  it("leaves out the Video being watched", () => {
    expect(ids(pickSuggestions(videos(3), "v2"))).toEqual(["v1", "v3"]);
  });

  it("keeps at most 12, in the listing's order", () => {
    expect(SUGGESTION_LIMIT).toBe(12);
    expect(ids(pickSuggestions(videos(24), "v5"))).toEqual([
      "v1", "v2", "v3", "v4", "v6", "v7", "v8", "v9", "v10", "v11", "v12", "v13",
    ]);
  });

  it("returns fewer than 12 when fewer exist", () => {
    expect(ids(pickSuggestions(videos(4), "v9"))).toEqual(["v1", "v2", "v3", "v4"]);
  });

  it("drops nothing when the Video being watched is not listed", () => {
    expect(pickSuggestions(videos(12), "elsewhere")).toHaveLength(12);
  });

  it("is empty when the only Video is the one being watched", () => {
    expect(pickSuggestions(videos(1), "v1")).toEqual([]);
  });
});
