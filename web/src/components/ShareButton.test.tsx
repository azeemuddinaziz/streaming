// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareButton } from "./ShareButton";

afterEach(() => vi.unstubAllGlobals());

function player(time: number) {
  const video = document.createElement("video");
  video.className = "player";
  Object.defineProperty(video, "currentTime", { value: time });
  document.body.append(video);
  return video;
}

describe("ShareButton", () => {
  it("opens a dialog with the link and closes on Escape, returning focus", async () => {
    const user = userEvent.setup();
    render(<ShareButton subject="video" title="T" withStartTime />);
    const trigger = screen.getByRole("button", { name: "Share" });

    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Share this video" })).toBeInTheDocument();
    expect(screen.getByLabelText("Link")).toHaveValue(window.location.origin + window.location.pathname);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("adds ?t= only when Start at is ticked, from the player's time at opening", async () => {
    const user = userEvent.setup();
    const video = player(83.7);
    render(<ShareButton subject="video" title="T" withStartTime />);
    await user.click(screen.getByRole("button", { name: "Share" }));

    const link = screen.getByLabelText("Link") as HTMLInputElement;
    expect(link.value).not.toContain("?t=");
    await user.click(screen.getByRole("checkbox", { name: "Start at 1:23" }));
    expect(link.value.endsWith("?t=83")).toBe(true);
    video.remove();
  });

  it("copies the link and says so", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<ShareButton subject="channel" title="T" />);
    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining(window.location.origin));
    expect(screen.getByRole("status")).toHaveTextContent("Link copied");
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("tells the person to copy by hand when the Clipboard API fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: vi.fn().mockRejectedValue(new Error("no")) } });
    render(<ShareButton subject="video" title="T" />);
    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(screen.getByRole("status")).toHaveTextContent(/Ctrl\+C/);
  });

  it("offers Share… only where navigator.share exists", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ShareButton subject="video" title="T" />);
    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(screen.queryByRole("button", { name: "Share…" })).toBeNull();
    unmount();

    vi.stubGlobal("navigator", { ...navigator, share: vi.fn() });
    render(<ShareButton subject="video" title="T" />);
    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(screen.getByRole("button", { name: "Share…" })).toBeInTheDocument();
  });

  it("shows only a note, with no link, for a PRIVATE Video", async () => {
    const user = userEvent.setup();
    render(<ShareButton subject="video" title="T" withStartTime privateVideo />);
    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(screen.getByText(/Only you can watch this/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Change Visibility/ })).toHaveAttribute("href", "/studio");
    expect(screen.queryByLabelText("Link")).toBeNull();
  });
});
