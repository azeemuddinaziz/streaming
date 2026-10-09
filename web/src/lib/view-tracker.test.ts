import { describe, expect, it, vi } from "vitest";
import { createViewTracker } from "./view-tracker";

function play(tracker: ReturnType<typeof createViewTracker>, from: number, to: number, duration: number) {
  for (let t = from; t <= to; t += 0.25) tracker.tick(t, duration);
}

describe("view tracker", () => {
  it("does not count before anything plays", () => {
    const onQualify = vi.fn();
    createViewTracker(onQualify);
    expect(onQualify).not.toHaveBeenCalled();
  });

  it("counts once after 30 seconds of playback", () => {
    const onQualify = vi.fn();
    const tracker = createViewTracker(onQualify);
    play(tracker, 0, 29, 600);
    expect(onQualify).not.toHaveBeenCalled();
    play(tracker, 29, 60, 600);
    expect(onQualify).toHaveBeenCalledTimes(1);
  });

  it("does not count seeking to the middle as watching", () => {
    const onQualify = vi.fn();
    const tracker = createViewTracker(onQualify);
    play(tracker, 0, 10, 600);
    tracker.tick(300, 600);
    tracker.tick(500, 600);
    play(tracker, 500, 510, 600);
    expect(onQualify).not.toHaveBeenCalled();
  });

  it("counts a Video shorter than 30 seconds when it ends, and a long one not at an early end", () => {
    const short = vi.fn();
    createViewTracker(short).ended(12);
    expect(short).toHaveBeenCalledTimes(1);

    const long = vi.fn();
    createViewTracker(long).ended(600);
    expect(long).not.toHaveBeenCalled();
  });

  it("counts a short Video once its full length has played", () => {
    const onQualify = vi.fn();
    const tracker = createViewTracker(onQualify);
    play(tracker, 0, 12, 12);
    expect(onQualify).toHaveBeenCalledTimes(1);
  });
});
