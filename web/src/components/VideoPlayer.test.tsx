// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hls = vi.hoisted(() => ({ instance: null as null | { nextLevel: number; levels: { height: number }[] } }));

vi.mock("hls.js", () => {
  class FakeHls {
    static isSupported = () => true;
    static Events = { ERROR: "e", MANIFEST_PARSED: "m", LEVEL_SWITCHED: "l" };
    nextLevel = -1;
    levels = [{ height: 360 }, { height: 720 }, { height: 1080 }];
    handlers: Record<string, (...args: unknown[]) => void> = {};
    constructor() {
      hls.instance = this;
    }
    on(name: string, handler: (...args: unknown[]) => void) {
      this.handlers[name] = handler;
    }
    loadSource() {
      this.handlers.m?.();
    }
    attachMedia() {}
    destroy() {}
  }
  return { default: FakeHls };
});
vi.mock("@/lib/api-client", () => ({ reportView: vi.fn() }));

import { VideoPlayer } from "./VideoPlayer";

const play = vi.fn(() => Promise.resolve());
const pause = vi.fn();

beforeEach(() => {
  hls.instance = null;
  play.mockClear();
  pause.mockClear();
  HTMLMediaElement.prototype.play = play;
  HTMLMediaElement.prototype.pause = pause;
  Object.defineProperty(HTMLMediaElement.prototype, "paused", { configurable: true, get: () => true });
});
afterEach(() => localStorage.clear());

async function setup() {
  const user = userEvent.setup();
  render(<VideoPlayer src="http://api/x.m3u8" label="Clip" videoId="v1" />);
  // hls.js is imported lazily.
  await screen.findByRole("group", { name: /Video player/ });
  await act(async () => {});
  const video = document.querySelector("video.player") as HTMLVideoElement;
  return { user, video };
}

describe("VideoPlayer", () => {
  it("draws its own controls instead of the native ones", async () => {
    const { video } = await setup();
    expect(video.hasAttribute("controls")).toBe(false);
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Seek" })).toBeInTheDocument();
  });

  it("plays from the button and from K, but leaves Space on a focused button alone", async () => {
    const { user } = await setup();
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(play).toHaveBeenCalledTimes(1);

    screen.getByRole("group", { name: /Video player/ }).focus();
    await user.keyboard("k");
    expect(play).toHaveBeenCalledTimes(2);

    screen.getByRole("button", { name: "Fullscreen" }).focus();
    await user.keyboard("k");
    expect(play).toHaveBeenCalledTimes(3);
  });

  it("seeks with the arrow keys and clamps", async () => {
    const { user, video } = await setup();
    Object.defineProperty(video, "duration", { configurable: true, value: 100 });
    video.currentTime = 50;
    screen.getByRole("group", { name: /Video player/ }).focus();
    await user.keyboard("{ArrowRight}");
    expect(video.currentTime).toBe(55);
    await user.keyboard("j");
    expect(video.currentTime).toBe(45);
    await user.keyboard("{End}");
    expect(video.currentTime).toBe(100);
  });

  it("sets playback speed from the menu and announces it", async () => {
    const { user, video } = await setup();
    await user.click(screen.getByRole("button", { name: /Playback speed/ }));
    await user.click(screen.getByRole("menuitemradio", { name: "1.5x" }));
    expect(video.playbackRate).toBe(1.5);
    expect(screen.getByRole("status")).toHaveTextContent("Speed 1.5x");
  });

  it("offers Auto and each rendition, and switches the hls.js level", async () => {
    const { user } = await setup();
    await user.click(screen.getByRole("button", { name: "Quality" }));
    const items = screen.getAllByRole("menuitemradio");
    expect(items.map((el) => el.textContent?.replace("✓", ""))).toEqual(["Auto", "1080p", "720p", "360p"]);
    expect(items[0]).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("menuitemradio", { name: "720p" }));
    expect(hls.instance?.nextLevel).toBe(1);
  });

  it("closes a menu on Escape and returns focus to its button", async () => {
    const { user } = await setup();
    const trigger = screen.getByRole("button", { name: "Quality" });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("opens the shortcut help with ? and closes it with Escape", async () => {
    const { user } = await setup();
    screen.getByRole("group", { name: /Video player/ }).focus();
    await user.keyboard("?");
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("remembers theater mode", async () => {
    const { user } = await setup();
    await user.click(screen.getByRole("button", { name: "Theater mode" }));
    expect(localStorage.getItem("player-theater")).toBe("1");
    expect(screen.getByRole("button", { name: "Theater mode" })).toHaveAttribute("aria-pressed", "true");
  });

  it("plays on Space when nothing on the page is focused", async () => {
    const { user } = await setup();
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard(" ");
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("raises the volume when unmuting at volume 0", async () => {
    const { user, video } = await setup();
    video.volume = 0;
    await user.click(screen.getByRole("button", { name: "Mute" }));
    expect(video.volume).toBe(0.5);
    expect(video.muted).toBe(false);
  });
});
