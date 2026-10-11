// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function Page({ dirty }: { dirty: boolean }) {
  const { dialog } = useUnsavedChangesGuard(dirty);
  return (
    <>
      <a href="/studio">Studio</a>
      <a href="https://example.com/">Elsewhere</a>
      {dialog}
    </>
  );
}

function reload(): BeforeUnloadEvent {
  const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
  window.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useUnsavedChangesGuard", () => {
  it("asks the browser to confirm a reload only while dirty", () => {
    const { rerender } = render(<Page dirty={false} />);
    expect(reload().defaultPrevented).toBe(false);

    rerender(<Page dirty />);
    expect(reload().defaultPrevented).toBe(true);

    rerender(<Page dirty={false} />);
    expect(reload().defaultPrevented).toBe(false);
  });

  it("lets a clean page's links through", async () => {
    render(<Page dirty={false} />);
    const link = screen.getByRole("link", { name: "Studio" });
    link.addEventListener("click", (event) => event.preventDefault());

    await userEvent.click(link);

    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("stops an in-app link while dirty, and goes there only on Leave", async () => {
    render(<Page dirty />);

    await userEvent.click(screen.getByRole("link", { name: "Studio" }));
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(push).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("link", { name: "Studio" }));
    await userEvent.click(await screen.findByRole("button", { name: "Leave" }));
    expect(push).toHaveBeenCalledWith("/studio");
  });

  it("asks before Back and keeps the person on the page on Keep editing", async () => {
    render(<Page dirty />);

    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("arms Back again after a clean Back used the spare entry up", async () => {
    const pushState = vi.spyOn(window.history, "pushState");
    const { rerender } = render(<Page dirty />);
    expect(pushState).toHaveBeenCalledTimes(1);

    rerender(<Page dirty={false} />);
    window.dispatchEvent(new PopStateEvent("popstate"));
    rerender(<Page dirty />);

    expect(pushState).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    pushState.mockRestore();
  });
});
