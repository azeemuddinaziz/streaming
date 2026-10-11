// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reactToVideo = vi.fn();
vi.mock("@/lib/api-client", () => ({ reactToVideo: (...a: unknown[]) => reactToVideo(...a), reactToComment: vi.fn() }));

import { ReactionButtons } from "./ReactionButtons";

beforeEach(() => reactToVideo.mockReset());

const base = { videoId: "v1", signedIn: true, likes: 5, myReaction: null } as const;

describe("ReactionButtons", () => {
  it("updates at once and settles on the server's counts", async () => {
    const user = userEvent.setup();
    reactToVideo.mockResolvedValue({ ok: true, state: { likes: 6, myReaction: "LIKE" } });
    render(<ReactionButtons {...base} />);
    await user.click(screen.getByRole("button", { name: /Like/ }));

    expect(reactToVideo).toHaveBeenCalledWith("v1", "LIKE");
    const like = screen.getByRole("button", { name: /Like · 6/ });
    expect(like).toHaveAttribute("aria-pressed", "true");
  });

  it("reverts with the message when the API refuses (429)", async () => {
    const user = userEvent.setup();
    reactToVideo.mockResolvedValue({ ok: false, message: "Too fast. Try again in 20 seconds." });
    render(<ReactionButtons {...base} />);
    await user.click(screen.getByRole("button", { name: /Like/ }));

    expect(screen.getByRole("alert")).toHaveTextContent("Too fast. Try again in 20 seconds.");
    expect(screen.getByRole("button", { name: /Like · 5/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("removes the Reaction when the active one is pressed again", async () => {
    const user = userEvent.setup();
    reactToVideo.mockResolvedValue({ ok: true, state: { likes: 4, myReaction: null } });
    render(<ReactionButtons {...base} myReaction="LIKE" />);
    await user.click(screen.getByRole("button", { name: /Like/ }));
    expect(reactToVideo).toHaveBeenCalledWith("v1", null);
  });

  it("shows the Dislike count only when given (the owner)", () => {
    const { unmount } = render(<ReactionButtons {...base} />);
    expect(screen.getByRole("button", { name: "Dislike" })).toBeInTheDocument();
    unmount();
    render(<ReactionButtons {...base} dislikes={2} />);
    expect(screen.getByRole("button", { name: "Dislike · 2" })).toBeInTheDocument();
  });

  it("is disabled signed out, with a link to sign in", () => {
    render(<ReactionButtons {...base} signedIn={false} />);
    expect(screen.getByRole("button", { name: /Like/ })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Sign in to react" })).toHaveAttribute("href", "/sign-in");
  });
});
