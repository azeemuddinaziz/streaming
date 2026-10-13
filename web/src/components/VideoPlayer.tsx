"use client";

import type Hls from "hls.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { reportView } from "@/lib/api-client";
import { clamp, shortcutFor, stepSpeed, tapZone, type ShortcutAction } from "@/lib/player-controls";
import { parseStartTime, startPosition } from "@/lib/share-link";
import { createViewTracker } from "@/lib/view-tracker";
import { cn } from "@/lib/utils";
import { PlayerControls, ShortcutsHelp, type QualityOption } from "./PlayerControls";

const THEATER_KEY = "player-theater";
const HIDE_AFTER_MS = 3000;
const DOUBLE_TAP_MS = 300;

// Plays an HLS stream. Safari plays it natively; elsewhere hls.js feeds the
// same <video>. The controls are our own, drawn over that element, which keeps
// the `player` class (Share reads its time), `?t=` and View counting as before.
export function VideoPlayer({ src, label, videoId }: { src: string; label: string; videoId: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastTap = useRef<{ time: number; zone: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(Number.NaN);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [theater, setTheater] = useState(false);
  const [qualities, setQualities] = useState<QualityOption[]>([]);
  const [quality, setQuality] = useState(-1);
  const [autoHeight, setAutoHeight] = useState<number | null>(null);
  const [active, setActive] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [pipAvailable, setPipAvailable] = useState(false);

  useEffect(() => {
    setPipAvailable(typeof document !== "undefined" && document.pictureInPictureEnabled === true);
    try {
      setTheater(localStorage.getItem(THEATER_KEY) === "1");
    } catch {
      // Storage can be blocked; the default layout is fine.
    }
  }, []);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (element.canPlayType("application/vnd.apple.mpegurl")) {
      element.src = src;
      const onError = () => setFailed(true);
      element.addEventListener("error", onError);
      return () => element.removeEventListener("error", onError);
    }

    let stop = () => {};
    let cancelled = false;
    import("hls.js").then(({ default: HlsClass }) => {
      if (cancelled) return;
      if (!HlsClass.isSupported()) return setFailed(true);
      const hls = new HlsClass();
      hlsRef.current = hls;
      hls.on(HlsClass.Events.ERROR, (_event, data) => {
        if (data.fatal) setFailed(true);
      });
      hls.on(HlsClass.Events.MANIFEST_PARSED, () => {
        setQualities(hls.levels.map((level, index) => ({ level: index, height: level.height })));
      });
      hls.on(HlsClass.Events.LEVEL_SWITCHED, (_event, data) => {
        setAutoHeight(hls.levels[data.level]?.height ?? null);
      });
      hls.loadSource(src);
      hls.attachMedia(element);
      stop = () => {
        hls.destroy();
        hlsRef.current = null;
      };
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [src]);

  // Opens at `?t=` (a Share link's start time), once, when the length is known.
  // An invalid value, or one past the end, plays from the start.
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const startAt = parseStartTime(window.location.search);
    if (startAt === null) return;
    const seek = () => {
      const position = startPosition(startAt, element.duration);
      if (position !== null) element.currentTime = position;
    };
    element.addEventListener("loadedmetadata", seek, { once: true });
    return () => element.removeEventListener("loadedmetadata", seek);
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

  // Mirrors the element's state into the controls.
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const sync = () => {
      setTime(element.currentTime);
      setDuration(element.duration);
      setVolume(element.volume);
      setMuted(element.muted);
      setSpeed(element.playbackRate);
    };
    const events = ["timeupdate", "durationchange", "loadedmetadata", "volumechange", "ratechange", "seeked"];
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    events.forEach((name) => element.addEventListener(name, sync));
    element.addEventListener("play", onPlay);
    element.addEventListener("pause", onPause);
    element.addEventListener("ended", onPause);
    return () => {
      events.forEach((name) => element.removeEventListener(name, sync));
      element.removeEventListener("play", onPlay);
      element.removeEventListener("pause", onPause);
      element.removeEventListener("ended", onPause);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === frame.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const wake = useCallback(() => {
    setActive(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setActive(false), HIDE_AFTER_MS);
  }, []);
  useEffect(() => {
    wake();
    return () => clearTimeout(hideTimer.current);
  }, [wake]);

  const say = (message: string) => setAnnouncement((previous) => (previous === message ? `${message} ` : message));

  function toggle() {
    const element = video.current;
    if (!element) return;
    if (element.paused) void element.play()?.catch(() => {});
    else element.pause();
  }

  function seekTo(seconds: number) {
    const element = video.current;
    if (!element || !Number.isFinite(element.duration)) return;
    element.currentTime = clamp(seconds, 0, element.duration);
  }

  function setVolumeTo(next: number) {
    const element = video.current;
    if (!element) return;
    element.volume = clamp(next, 0, 1);
    element.muted = element.volume === 0;
    say(`Volume ${Math.round(element.volume * 100)}%`);
  }

  function toggleMute() {
    const element = video.current;
    if (!element) return;
    element.muted = !element.muted;
    say(element.muted ? "Muted" : "Unmuted");
  }

  function setSpeedTo(next: number) {
    const element = video.current;
    if (element) element.playbackRate = next;
    say(`Speed ${next}x`);
  }

  function setQualityTo(level: number) {
    if (hlsRef.current) hlsRef.current.currentLevel = level;
    setQuality(level);
    const height = qualities.find((q) => q.level === level)?.height;
    say(level === -1 ? "Quality automatic" : `Quality ${height}p`);
  }

  function toggleTheater() {
    const next = !theater;
    setTheater(next);
    say(next ? "Theater mode on" : "Theater mode off");
    try {
      localStorage.setItem(THEATER_KEY, next ? "1" : "0");
    } catch {
      // Not remembered; still applied.
    }
  }

  function toggleFullscreen() {
    const element = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (frame.current?.requestFullscreen) {
      void frame.current.requestFullscreen().catch(() => {});
    } else {
      // iPhone Safari only fullscreens the video itself, with its own controls.
      element?.webkitEnterFullscreen?.();
    }
  }

  function togglePip() {
    const element = video.current;
    if (!element) return;
    if (document.pictureInPictureElement) void document.exitPictureInPicture().catch(() => {});
    else void element.requestPictureInPicture?.().catch(() => {});
  }

  function run(action: ShortcutAction) {
    const element = video.current;
    if (!element) return;
    switch (action.type) {
      case "toggle":
        return toggle();
      case "seek":
        return seekTo(element.currentTime + action.by);
      case "volume":
        return setVolumeTo((element.muted ? 0 : element.volume) + action.by);
      case "mute":
        return toggleMute();
      case "fullscreen":
        return toggleFullscreen();
      case "theater":
        return toggleTheater();
      case "pip":
        return pipAvailable ? togglePip() : undefined;
      case "jump":
        return Number.isFinite(element.duration) ? seekTo(element.duration * action.fraction) : undefined;
      case "speed":
        return setSpeedTo(stepSpeed(element.playbackRate, action.direction));
      case "help":
        return setHelp(true);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    wake();
    const target = event.target as HTMLElement;
    // Menus and the help dialog look after their own keys.
    if (target.closest('[role="menu"], [role="dialog"]')) return;
    const action = shortcutFor(event.key, {
      ctrl: event.ctrlKey,
      meta: event.metaKey,
      alt: event.altKey,
      shift: event.shiftKey,
    });
    if (!action) return;
    // A focused slider keeps its arrows, a focused button its Space.
    if (target instanceof HTMLInputElement && target.type === "range" && event.key.startsWith("Arrow")) return;
    if (target.closest("button") && event.key === " ") return;
    event.preventDefault();
    run(action);
  }

  // A mouse click toggles playback. A touch shows the controls first; a double
  // tap in the outer thirds seeks 10 seconds that way.
  function onSurfacePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    frame.current?.focus({ preventScroll: true });
    if (event.pointerType !== "touch") {
      toggle();
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const zone = tapZone(event.clientX - rect.left, rect.width);
    const previous = lastTap.current;
    const now = Date.now();
    if (previous && zone !== "middle" && zone === previous.zone && now - previous.time < DOUBLE_TAP_MS) {
      lastTap.current = null;
      const by = zone === "back" ? -10 : 10;
      run({ type: "seek", by });
      say(`${by > 0 ? "Forward" : "Back"} 10 seconds`);
      return;
    }
    lastTap.current = { time: now, zone };
    if (!active) wake();
    else toggle();
  }

  const visible = active || !playing || menuOpen || help;

  return (
    <>
      <div
        ref={frame}
        tabIndex={-1}
        role="group"
        aria-label={`Video player: ${label}`}
        onKeyDown={onKeyDown}
        onPointerMove={wake}
        onFocus={wake}
        className={cn(
          "relative mx-auto aspect-video w-full overflow-hidden rounded-lg bg-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
          !theater && "max-w-5xl",
          fullscreen && "max-w-none rounded-none",
        )}
      >
        <video
          ref={video}
          className="player size-full"
          playsInline
          preload="metadata"
          aria-label={label}
          onDoubleClick={() => {
            if (!window.matchMedia?.("(pointer: coarse)").matches) toggleFullscreen();
          }}
        />
        <div className="absolute inset-0 bottom-20" onPointerUp={onSurfacePointerUp} aria-hidden />
        <PlayerControls
          playing={playing}
          fullscreen={fullscreen}
          theater={theater}
          qualities={qualities}
          quality={quality}
          autoHeight={autoHeight}
          pipAvailable={pipAvailable}
          visible={visible}
          onToggle={toggle}
          onSeek={seekTo}
          onMute={toggleMute}
          onVolume={setVolumeTo}
          onSpeed={setSpeedTo}
          onQuality={setQualityTo}
          onPip={togglePip}
          onTheater={toggleTheater}
          onFullscreen={toggleFullscreen}
          onHelp={() => setHelp(true)}
          onMenuOpenChange={setMenuOpen}
          state={{ time, duration, volume, muted, speed }}
        />
        {help && <ShortcutsHelp onClose={() => setHelp(false)} />}
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </div>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          This video could not be played in your browser. Try reloading the page.
        </p>
      )}
    </>
  );
}
