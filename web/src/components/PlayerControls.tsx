"use client";

import {
  Keyboard,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RectangleHorizontal,
  Settings,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AUTO_LEVEL, SHORTCUTS, SPEEDS, formatTime, qualityLabel } from "@/lib/player-controls";

const buttonClass =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-md text-background outline-none hover:bg-background/20 focus-visible:ring-[3px] focus-visible:ring-ring [&_svg]:size-5";

function ControlButton({
  label,
  pressed,
  className,
  children,
  ...props
}: {
  label: string;
  pressed?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<React.ComponentProps<"button">, "aria-label" | "aria-pressed">) {
  return (
    <button type="button" aria-label={label} aria-pressed={pressed} className={cn(buttonClass, className)} {...props}>
      {children}
    </button>
  );
}

// A small radio menu drawn inside the player (a portalled menu would vanish
// in fullscreen, which only shows the player's own subtree).
function Menu({
  label,
  options,
  value,
  onSelect,
  onOpenChange,
  icon,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onSelect: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  icon: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();

  function menuItems() {
    return Array.from(list.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []);
  }

  function setOpenState(next: boolean) {
    setOpen(next);
    onOpenChange(next);
  }

  useEffect(() => {
    if (!open) return;
    const items = menuItems();
    (items.find((el) => el.getAttribute("aria-checked") === "true") ?? items[0])?.focus();
  }, [open]);

  function onKeyDown(event: React.KeyboardEvent) {
    const items = menuItems();
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpenState(false);
      trigger.current?.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(at + step + items.length) % items.length]?.focus();
    } else if (event.key === "Tab") {
      setOpenState(false);
    }
  }

  return (
    <div className="relative">
      <ControlButton
        ref={trigger}
        label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpenState(!open)}
      >
        {icon}
      </ControlButton>
      {open && (
        <div
          ref={list}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          className="absolute right-0 bottom-full mb-2 max-h-60 min-w-32 overflow-y-auto rounded-md border bg-foreground p-1 text-background shadow-md"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              onClick={() => {
                onSelect(option.value);
                setOpenState(false);
                trigger.current?.focus();
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-background/20 focus-visible:ring-[3px] focus-visible:ring-ring"
            >
              <span className="w-4 text-center" aria-hidden>
                {option.value === value ? "✓" : ""}
              </span>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export type QualityOption = { level: number; height: number };

export function PlayerControls({
  playing,
  fullscreen,
  theater,
  qualities,
  quality,
  autoHeight,
  pipAvailable,
  visible,
  onToggle,
  onSeek,
  onMute,
  onVolume,
  onSpeed,
  onQuality,
  onPip,
  onTheater,
  onFullscreen,
  onHelp,
  onMenuOpenChange,
  state,
}: {
  playing: boolean;
  fullscreen: boolean;
  theater: boolean;
  qualities: QualityOption[];
  quality: number;
  autoHeight: number | null;
  pipAvailable: boolean;
  visible: boolean;
  onToggle: () => void;
  onSeek: (seconds: number) => void;
  onMute: () => void;
  onVolume: (volume: number) => void;
  onSpeed: (speed: number) => void;
  onQuality: (level: number) => void;
  onPip: () => void;
  onTheater: () => void;
  onFullscreen: () => void;
  onHelp: () => void;
  onMenuOpenChange: (open: boolean) => void;
  state: { time: number; duration: number; volume: number; muted: boolean; speed: number };
}) {
  const { time, duration, volume, muted, speed } = state;
  const known = Number.isFinite(duration) && duration > 0;
  const silent = muted || volume === 0;

  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 grid gap-1 rounded-b-[inherit] bg-foreground/80 px-2 pt-1 pb-1.5 text-background transition-opacity",
        visible ? "opacity-100" : "pointer-events-none opacity-0 focus-within:pointer-events-auto focus-within:opacity-100",
      )}
    >
      <input
        type="range"
        aria-label="Seek"
        min={0}
        max={known ? duration : 0}
        step={1}
        value={known ? Math.min(time, duration) : 0}
        disabled={!known}
        aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
        onChange={(event) => onSeek(Number(event.target.value))}
        className="h-4 w-full cursor-pointer accent-primary"
      />
      <div className="flex items-center gap-1">
        <ControlButton label={playing ? "Pause" : "Play"} onClick={onToggle}>
          {playing ? <Pause /> : <Play />}
        </ControlButton>
        <ControlButton label={silent ? "Unmute" : "Mute"} pressed={silent} onClick={onMute}>
          {silent ? <VolumeX /> : <Volume2 />}
        </ControlButton>
        <input
          type="range"
          aria-label="Volume"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)}%`}
          onChange={(event) => onVolume(Number(event.target.value))}
          className="hidden h-4 w-20 cursor-pointer accent-primary sm:block"
        />
        <span className="ml-1 text-xs tabular-nums" aria-hidden>
          {formatTime(time)} / {formatTime(duration)}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Menu
            label={`Playback speed, ${speed}x`}
            icon={<span className="text-xs font-semibold">{speed}x</span>}
            value={String(speed)}
            options={SPEEDS.map((s) => ({ value: String(s), label: s === 1 ? "Normal" : `${s}x` }))}
            onSelect={(value) => onSpeed(Number(value))}
            onOpenChange={onMenuOpenChange}
          />
          {qualities.length > 0 && (
            <Menu
              label="Quality"
              icon={<Settings />}
              value={String(quality)}
              options={[
                { value: String(AUTO_LEVEL), label: autoHeight ? `Auto (${qualityLabel(autoHeight)})` : "Auto" },
                ...[...qualities]
                  .sort((a, b) => b.height - a.height)
                  .map((q) => ({ value: String(q.level), label: qualityLabel(q.height) })),
              ]}
              onSelect={(value) => onQuality(Number(value))}
              onOpenChange={onMenuOpenChange}
            />
          )}
          <ControlButton label="Keyboard shortcuts" onClick={onHelp}>
            <Keyboard />
          </ControlButton>
          {pipAvailable && (
            <ControlButton label="Picture-in-picture" onClick={onPip}>
              <PictureInPicture2 />
            </ControlButton>
          )}
          <ControlButton label="Theater mode" pressed={theater} onClick={onTheater} className="hidden lg:inline-flex">
            <RectangleHorizontal />
          </ControlButton>
          <ControlButton label={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={onFullscreen}>
            {fullscreen ? <Minimize /> : <Maximize />}
          </ControlButton>
        </div>
      </div>
    </div>
  );
}

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onKeyDown={(event) => {
        // The close button is the only stop, so Tab stays inside.
        if (event.key === "Tab") event.preventDefault();
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
      className="absolute inset-0 grid place-items-center overflow-auto rounded-[inherit] bg-foreground/90 p-4 text-background"
    >
      <div className="w-full max-w-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-sans text-base font-semibold">Keyboard shortcuts</h2>
          <ControlButton ref={close} label="Close shortcuts" onClick={onClose}>
            <X />
          </ControlButton>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.keys} className="contents">
              <dt className="font-mono font-semibold">{shortcut.keys}</dt>
              <dd>{shortcut.does}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
