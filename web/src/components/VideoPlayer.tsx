"use client";

import { useEffect, useRef, useState } from "react";

// Plays an HLS stream. Safari plays it natively; elsewhere hls.js feeds the
// same <video>, whose built-in controls are keyboard accessible.
export function VideoPlayer({ src, label }: { src: string; label: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (element.canPlayType("application/vnd.apple.mpegurl")) {
      element.src = src;
      return;
    }

    let stop = () => {};
    import("hls.js").then(({ default: Hls }) => {
      if (!Hls.isSupported()) return setFailed(true);
      const hls = new Hls();
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) setFailed(true);
      });
      hls.loadSource(src);
      hls.attachMedia(element);
      stop = () => hls.destroy();
    });
    return () => stop();
  }, [src]);

  return (
    <>
      <video ref={video} className="player" controls playsInline preload="metadata" aria-label={label} />
      {failed && (
        <p role="alert">This video could not be played in your browser. Try reloading the page.</p>
      )}
    </>
  );
}
