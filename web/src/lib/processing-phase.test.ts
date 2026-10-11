import { describe, expect, it } from "vitest";
import type { StudioVideo } from "@/lib/api-client";
import {
  departedSince,
  finishedMessage,
  finishedSince,
  hasProcessing,
  processingSteps,
  progressView,
  updateInPlace,
} from "./processing-phase";

const video = (id: string, patch: Partial<StudioVideo> = {}): StudioVideo => ({
  id,
  label: `${id}.mp4`,
  title: null,
  description: null,
  status: "PROCESSING",
  processingProgress: null,
  visibility: "PRIVATE",
  commentsEnabled: true,
  likes: 0,
  dislikes: 0,
  createdAt: "2026-10-11T00:00:00.000Z",
  thumbnailPath: null,
  ...patch,
});

describe("progressView", () => {
  it("is determinate for a number and clamps it to 0..100", () => {
    expect(progressView(42.4)).toEqual({ determinate: true, percent: 42, text: "42%" });
    expect(progressView(0)).toEqual({ determinate: true, percent: 0, text: "0%" });
    expect(progressView(250)).toMatchObject({ percent: 100 });
    expect(progressView(-3)).toMatchObject({ percent: 0 });
  });

  it("says Starting… for null, undefined and NaN", () => {
    for (const value of [null, undefined, Number.NaN]) {
      expect(progressView(value)).toEqual({ determinate: false, text: "Starting…" });
    }
  });
});

describe("processingSteps", () => {
  it("has Uploaded done, Processing current and Ready next", () => {
    expect(processingSteps().map((step) => [step.label, step.state])).toEqual([
      ["Uploaded", "done"],
      ["Processing", "current"],
      ["Ready", "next"],
    ]);
  });
});

describe("finishedSince", () => {
  it("names only Videos that left PROCESSING", () => {
    const before = [video("a"), video("b"), video("c", { status: "READY" })];
    const after = [
      video("a", { processingProgress: 80 }),
      video("b", { status: "FAILED" }),
      video("c", { status: "READY" }),
    ];
    expect(finishedSince(before, after)).toEqual([{ id: "b", label: "b.mp4", status: "FAILED" }]);
  });

  it("ignores a Video that was not in the earlier list", () => {
    expect(finishedSince([], [video("a", { status: "READY" })])).toEqual([]);
  });
});

describe("hasProcessing and updateInPlace", () => {
  it("polls only while something is processing", () => {
    expect(hasProcessing([video("a", { status: "READY" }), video("b")])).toBe(true);
    expect(hasProcessing([video("a", { status: "READY" }), video("b", { status: "FAILED" })])).toBe(false);
  });

  it("replaces by id, keeps order, and keeps rows the poll lacks", () => {
    const current = [video("a"), video("b"), video("c")];
    const next = updateInPlace(current, [video("c", { processingProgress: 9 }), video("a", { processingProgress: 7 })]);
    expect(next.map((v) => [v.id, v.processingProgress])).toEqual([["a", 7], ["b", null], ["c", 9]]);
  });
});

describe("departedSince", () => {
  it("names processing rows the poll no longer returns, not finished ones", () => {
    const current = [video("a"), video("b"), video("c", { status: "READY" })];
    expect(departedSince(current, [video("b")]).map((v) => v.id)).toEqual(["a"]);
  });
});

describe("finishedMessage", () => {
  it("has one wording per outcome", () => {
    expect(finishedMessage({ label: "a.mp4", status: "READY" })).toBe("a.mp4 is ready");
    expect(finishedMessage({ label: "a.mp4", status: "FAILED" })).toBe("a.mp4 could not be processed");
    expect(finishedMessage({ label: "a.mp4", status: "GONE" })).toBe("a.mp4 has finished processing");
  });
});
