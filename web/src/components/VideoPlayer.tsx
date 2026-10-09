"use client";

import { useEffect, useRef, useState } from "react";
import { reportView } from "@/lib/api-client";
import { createViewTracker } from "@/lib/view-tracker";

// Plays an HLS stream. Safari plays it natively; elsewhere hls.js feeds the
// same <video>, whose built-in controls are keyboard accessible.
export function VideoPlayer({ src, label, videoId }: { src: string; label: string; videoId: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (element.canPlayType("application/vnd.apple.mpegurl")) {
      element.src = src;
      element.addEventListener("error", () => setFailed(true));
      return;
    }

    let stop = () => {};
    let cancelled = false;
    import("hls.js").then(({ default: Hls }) => {
      if (cancelled) return;
      if (!Hls.isSupported()) return setFailed(true);
      const hls = new Hls();
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) setFailed(true);
      });
      hls.loadSource(src);
      hls.attachMedia(element);
      stop = () => hls.destroy();
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [src]);

  // Reports a View once playback has run long enough (see view-tracker).
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const tracker = createViewTracker(() => void reportView(videoId));
    const onTime = () => tracker.tick(element.currentTime, element.duration);
    const onEnded = () => tracker.ended(element.duration);
    const onInterrupt = () => tracker.interrupt();
    element.addEventListener("timeupdate", onTime);
    element.addEventListener("ended", onEnded);
    element.addEventListener("pause", onInterrupt);
    element.addEventListener("seeking", onInterrupt);
    return () => {
      element.removeEventListener("timeupdate", onTime);
      element.removeEventListener("ended", onEnded);
      element.removeEventListener("pause", onInterrupt);
      element.removeEventListener("seeking", onInterrupt);
    };
  }, [videoId]);

  return (
    <>
      <video ref={video} className="player" controls playsInline preload="metadata" aria-label={label} />
      {failed && (
        <p role="alert">This video could not be played in your browser. Try reloading the page.</p>
      )}
    </>
  );
}
