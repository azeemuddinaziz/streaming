// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setSubscription = vi.fn();
const getSubscriptionsPage = vi.fn();
vi.mock("@/lib/api-client", () => ({
  setSubscription: (...a: unknown[]) => setSubscription(...a),
  getSubscriptionsPage: (...a: unknown[]) => getSubscriptionsPage(...a),
}));
const toastFn = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: Object.assign((...a: unknown[]) => toastFn(...a), { error: (...a: unknown[]) => toastError(...a) }) }));

import { SubscriptionList } from "./SubscriptionList";

const channel = (name: string) => ({ name, subscribers: 3, subscribed: true as const });

beforeEach(() => {
  setSubscription.mockReset();
  getSubscriptionsPage.mockReset();
  toastFn.mockReset();
  toastError.mockReset();
  window.sessionStorage.clear();
});

describe("SubscriptionList", () => {
  it("appends the next page on Load more", async () => {
    getSubscriptionsPage.mockResolvedValue({ ok: true, channels: [channel("cy")], page: 2, hasMore: false });
    render(<SubscriptionList channels={[channel("ann"), channel("bo")]} hasMore />);
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(getSubscriptionsPage).toHaveBeenCalledWith(2);
    expect(await screen.findByText("cy")).toBeInTheDocument();
  });

  it("removes a row on unsubscribe and Undo subscribes again and brings it back", async () => {
    setSubscription.mockResolvedValueOnce({ ok: true, state: { subscribed: false, subscribers: 2 } });
    render(<SubscriptionList channels={[channel("ann"), channel("bo")]} hasMore={false} />);
    await userEvent.click(screen.getAllByRole("button", { name: "Subscribed" })[0]);

    expect(setSubscription).toHaveBeenCalledWith("ann", false);
    expect(screen.queryByText("ann")).not.toBeInTheDocument();
    expect(screen.getByText("bo")).toBeInTheDocument();

    const [, options] = toastFn.mock.calls[0];
    setSubscription.mockResolvedValueOnce({ ok: true, state: { subscribed: true, subscribers: 3 } });
    options.action.onClick();

    expect(await screen.findByText("ann")).toBeInTheDocument();
    expect(setSubscription).toHaveBeenLastCalledWith("ann", true);
  });

  it("shows the empty state when the last row is removed", async () => {
    setSubscription.mockResolvedValue({ ok: true, state: { subscribed: false, subscribers: 0 } });
    render(<SubscriptionList channels={[channel("ann")]} hasMore={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Subscribed" }));

    expect(await screen.findByRole("link", { name: "Find something to watch" })).toHaveAttribute("href", "/");
  });

  it("keeps a removed row out of the Back snapshot", async () => {
    setSubscription.mockResolvedValue({ ok: true, state: { subscribed: false, subscribers: 2 } });
    render(<SubscriptionList channels={[channel("ann"), channel("bo")]} hasMore={false} />);
    await userEvent.click(screen.getAllByRole("button", { name: "Subscribed" })[0]);

    const saved = Object.entries(window.sessionStorage).find(([key]) => key.includes("subscriptions"));
    expect(saved).toBeDefined();
    expect(saved![1]).not.toContain("ann");
    expect(saved![1]).toContain("bo");
  });

  it("offers Try again when Undo fails, and the row stays away", async () => {
    setSubscription.mockResolvedValueOnce({ ok: true, state: { subscribed: false, subscribers: 2 } });
    render(<SubscriptionList channels={[channel("ann"), channel("bo")]} hasMore={false} />);
    await userEvent.click(screen.getAllByRole("button", { name: "Subscribed" })[0]);

    setSubscription.mockResolvedValueOnce({ ok: false, message: "Slow down." });
    toastFn.mock.calls[0][1].action.onClick();
    await vi.waitFor(() => expect(toastError).toHaveBeenCalled());

    expect(toastError.mock.calls[0][1].action.label).toBe("Try again");
    expect(screen.queryByText("ann")).not.toBeInTheDocument();
  });
});
