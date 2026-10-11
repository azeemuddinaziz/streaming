import { describe, expect, it } from "vitest";
import {
  classifyUploadError,
  formatBytes,
  formatRemaining,
  initialUploadState,
  milestone,
  remainingSeconds,
  uploadReducer,
  validateVideoFile,
  type UploadState,
} from "./upload-state";

const file = { name: "holiday.mp4", size: 10_000, type: "video/mp4" };

function run(events: Parameters<typeof uploadReducer>[1][], from: UploadState = initialUploadState) {
  return events.reduce(uploadReducer, from);
}

describe("validateVideoFile", () => {
  it("accepts a video type, or a known video extension when the type is empty", () => {
    expect(validateVideoFile(file)).toBeNull();
    expect(validateVideoFile({ name: "clip.MKV", size: 5, type: "" })).toBeNull();
  });

  it("explains a file that is not a video, and an empty one", () => {
    expect(validateVideoFile({ name: "notes.pdf", size: 5, type: "application/pdf" })).toMatch(/not a video/i);
    expect(validateVideoFile({ name: "clip.mp4", size: 0, type: "video/mp4" })).toMatch(/empty/i);
  });
});

describe("uploadReducer", () => {
  it("moves from a chosen file to uploading to done", () => {
    let state = run([{ type: "choose", file }]);
    expect(state).toMatchObject({ phase: "ready", file });

    state = run([{ type: "start", resumed: false, now: 0 }], state);
    expect(state).toMatchObject({ phase: "uploading", sent: 0, total: 10_000, resumed: false });

    state = run([{ type: "progress", sent: 4_000, total: 10_000, now: 1000 }], state);
    expect(state).toMatchObject({ phase: "uploading", sent: 4_000 });

    state = run([{ type: "success" }], state);
    expect(state).toMatchObject({ phase: "done", file });
  });

  it("keeps a rejected file out of the flow, with the reason", () => {
    const state = run([{ type: "choose", file: { name: "a.txt", size: 3, type: "text/plain" } }]);
    expect(state).toMatchObject({ phase: "idle" });
    expect((state as { problem?: string }).problem).toMatch(/not a video/i);
  });

  it("pauses and resumes, restarting the speed measure", () => {
    let state = run([
      { type: "choose", file },
      { type: "start", resumed: false, now: 0 },
      { type: "progress", sent: 5_000, total: 10_000, now: 5000 },
      { type: "pause" },
    ]);
    expect(state).toMatchObject({ phase: "paused", sent: 5_000 });

    state = run([{ type: "resume", now: 9000 }], state);
    expect(state).toMatchObject({ phase: "uploading", sent: 5_000, startedAt: 9000, startSent: null });

    // The first progress after resuming sets the baseline, so the offset is not read as speed.
    state = run([{ type: "progress", sent: 5_000, total: 10_000, now: 9100 }], state);
    expect(state).toMatchObject({ startedAt: 9100, startSent: 5_000 });
    expect(remainingSeconds(state as never, 9100)).toBeNull();
  });

  it("still finishes when the last byte lands during a pause", () => {
    const state = run([
      { type: "choose", file },
      { type: "start", resumed: false, now: 0 },
      { type: "pause" },
      { type: "success" },
    ]);
    expect(state).toMatchObject({ phase: "done", file });
  });

  it("ignores progress that arrives after a pause", () => {
    const state = run([
      { type: "choose", file },
      { type: "start", resumed: false, now: 0 },
      { type: "pause" },
      { type: "progress", sent: 9_000, total: 10_000, now: 100 },
    ]);
    expect(state).toMatchObject({ phase: "paused", sent: 0 });
  });

  it("fails with a kind and retries from where it stopped", () => {
    let state = run([
      { type: "choose", file },
      { type: "start", resumed: false, now: 0 },
      { type: "progress", sent: 2_000, total: 10_000, now: 1000 },
      { type: "error", kind: "network" },
    ]);
    expect(state).toMatchObject({ phase: "failed", kind: "network", sent: 2_000 });

    state = run([{ type: "start", resumed: true, now: 5000 }], state);
    expect(state).toMatchObject({ phase: "uploading", resumed: true, sent: 2_000, startedAt: 5000, startSent: null });
  });

  it("goes back to choosing a file on cancel or reset", () => {
    const uploading = run([
      { type: "choose", file },
      { type: "start", resumed: false, now: 0 },
    ]);
    expect(run([{ type: "cancel" }], uploading)).toEqual(initialUploadState);
    expect(run([{ type: "reset" }], uploading)).toEqual(initialUploadState);
  });

  it("ignores a late error or success once cancelled", () => {
    const state = run([
      { type: "choose", file },
      { type: "start", resumed: false, now: 0 },
      { type: "cancel" },
      { type: "error", kind: "network" },
      { type: "success" },
    ]);
    expect(state).toEqual(initialUploadState);
  });
});

describe("classifyUploadError", () => {
  it("tells signed out, refused and network apart", () => {
    expect(classifyUploadError(401)).toBe("signed-out");
    expect(classifyUploadError(400)).toBe("rejected");
    expect(classifyUploadError(413)).toBe("rejected");
    expect(classifyUploadError(null)).toBe("network");
    expect(classifyUploadError(502)).toBe("network");
  });
});

describe("remainingSeconds", () => {
  const base = { startedAt: 0, startSent: 0, sent: 0, total: 10_000 };

  it("estimates from the speed of this run", () => {
    expect(remainingSeconds({ ...base, sent: 2_500 }, 5_000)).toBe(15);
  });

  it("is unknown until a baseline is taken", () => {
    expect(remainingSeconds({ ...base, startSent: null, sent: 5_000 }, 9_000)).toBeNull();
  });

  it("is unknown before there is enough to measure", () => {
    expect(remainingSeconds({ ...base, sent: 0 }, 5_000)).toBeNull();
    expect(remainingSeconds({ ...base, sent: 500 }, 500)).toBeNull();
  });
});

describe("formatting", () => {
  it("formats sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1_500)).toBe("1.5 kB");
    expect(formatBytes(25_000_000)).toBe("25 MB");
    expect(formatBytes(2_400_000_000)).toBe("2.4 GB");
  });

  it("formats remaining time", () => {
    expect(formatRemaining(null)).toBe("Estimating time left…");
    expect(formatRemaining(1)).toBe("About 1 second left");
    expect(formatRemaining(45)).toBe("About 45 seconds left");
    expect(formatRemaining(90)).toBe("About 2 minutes left");
    expect(formatRemaining(3_700)).toBe("About 1 hour 2 minutes left");
  });
});

describe("milestone", () => {
  it("steps by a quarter, so a screen reader is not flooded", () => {
    expect(milestone(0)).toBe(0);
    expect(milestone(24)).toBe(0);
    expect(milestone(25)).toBe(25);
    expect(milestone(99)).toBe(75);
  });
});
