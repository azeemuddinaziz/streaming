export const VIEW_AFTER_SECONDS = 30;

// Decides when playback has run long enough to count as a View: 30 seconds
// actually played, or the whole Video if it is shorter. Opening the page, and
// seeking ahead, do not add played time. `onQualify` is called at most once.
export function createViewTracker(onQualify: () => void) {
  let played = 0;
  let last: number | undefined;
  let done = false;

  function qualify() {
    if (done) return;
    done = true;
    onQualify();
  }

  return {
    // Feed every `timeupdate` while playing. Steps of up to 2 seconds are
    // normal playback; larger jumps are seeks.
    tick(currentTime: number, duration: number) {
      if (last !== undefined) {
        const step = currentTime - last;
        if (step > 0 && step <= 2) played += step;
      }
      last = currentTime;
      if (Number.isFinite(duration) && played >= Math.min(VIEW_AFTER_SECONDS, duration)) qualify();
    },
    // Reaching the end counts for a short Video that was played through (the
    // first step of a play is never measured, hence 90%, not all); skipping
    // to its last seconds does not. A long Video still needs 30 seconds played.
    ended(duration: number) {
      if (Number.isFinite(duration) && duration < VIEW_AFTER_SECONDS && played >= duration * 0.9) qualify();
    },
    // After pausing or seeking, the next tick has no previous position.
    interrupt() {
      last = undefined;
    },
  };
}
