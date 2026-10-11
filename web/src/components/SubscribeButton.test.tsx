// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setSubscription = vi.fn();
vi.mock("@/lib/api-client", () => ({ setSubscription: (...a: unknown[]) => setSubscription(...a) }));

import { SubscribeButton } from "./SubscribeButton";

beforeEach(() => setSubscription.mockReset());

const base = { channelName: "ann", signedIn: true, isOwner: false, subscribers: 1, subscribed: false };

describe("SubscribeButton", () => {
  it("subscribes optimistically and keeps the server's count", async () => {
    const user = userEvent.setup();
    setSubscription.mockResolvedValue({ ok: true, state: { subscribed: true, subscribers: 2 } });
    render(<SubscribeButton {...base} />);
    await user.click(screen.getByRole("button", { name: "Subscribe" }));

    expect(setSubscription).toHaveBeenCalledWith("ann", true);
    expect(screen.getByRole("button", { name: "Subscribed" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("2 subscribers")).toBeInTheDocument();
  });

  it("reverts with the message on failure", async () => {
    const user = userEvent.setup();
    setSubscription.mockResolvedValue({ ok: false, message: "Slow down. Try again in 9 seconds." });
    render(<SubscribeButton {...base} />);
    await user.click(screen.getByRole("button", { name: "Subscribe" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Slow down");
    expect(screen.getByRole("button", { name: "Subscribe" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("1 subscriber")).toBeInTheDocument();
  });

  it("shows the owner the count only, and signed out a sign-in link", () => {
    const { unmount } = render(<SubscribeButton {...base} isOwner />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("1 subscriber")).toBeInTheDocument();
    unmount();
    render(<SubscribeButton {...base} signedIn={false} />);
    expect(screen.getByRole("link", { name: "Sign in to subscribe" })).toBeInTheDocument();
  });
});
