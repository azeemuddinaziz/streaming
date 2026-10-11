// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditVideoForm } from "./EditVideoForm";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api-client", () => ({ updateVideoDetails: vi.fn() }));

import { toast } from "sonner";
import { updateVideoDetails } from "@/lib/api-client";

const blank = { title: "", description: "", visibility: "PRIVATE", commentsEnabled: true } as const;

function reload(): BeforeUnloadEvent {
  const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
  window.dispatchEvent(event);
  return event;
}

// Radix's Checkbox measures itself; jsdom has no ResizeObserver.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EditVideoForm", () => {
  it("counts characters as the person types", async () => {
    render(<EditVideoForm videoId="v1" initial={blank} />);

    await userEvent.type(screen.getByLabelText("Title"), "Holiday");

    expect(screen.getByText("7 / 100")).toBeTruthy();
    expect(screen.getByText("0 / 5,000")).toBeTruthy();
  });

  it("disables Unlisted and Public with the reason until a title and description are filled", async () => {
    render(<EditVideoForm videoId="v1" initial={blank} />);
    const unlisted = screen.getByRole("radio", { name: /Unlisted/ }) as HTMLInputElement;
    const publicChoice = screen.getByRole("radio", { name: /Public/ }) as HTMLInputElement;

    expect(unlisted.disabled).toBe(true);
    expect(publicChoice.disabled).toBe(true);
    expect(screen.getAllByText(/Add a title and a description first\./).length).toBeGreaterThan(0);

    await userEvent.type(screen.getByLabelText("Title"), "Holiday");
    expect(unlisted.disabled).toBe(true);
    expect(screen.getAllByText(/Add a description first\./).length).toBeGreaterThan(0);

    await userEvent.type(screen.getByLabelText("Description"), "Two weeks away");
    expect(unlisted.disabled).toBe(false);
    expect(publicChoice.disabled).toBe(false);
  });

  it("blocks saving a non-private Video whose title was cleared, and says why", async () => {
    render(
      <EditVideoForm
        videoId="v1"
        initial={{ title: "Holiday", description: "Two weeks", visibility: "PUBLIC", commentsEnabled: true }}
      />,
    );

    await userEvent.clear(screen.getByLabelText("Title"));

    expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText("Add a title first.").length).toBeGreaterThan(0);
  });

  it("warns before leaving only while the form is dirty", async () => {
    render(<EditVideoForm videoId="v1" initial={blank} />);
    expect(reload().defaultPrevented).toBe(false);

    await userEvent.type(screen.getByLabelText("Title"), "H");
    expect(reload().defaultPrevented).toBe(true);

    await userEvent.clear(screen.getByLabelText("Title"));
    expect(reload().defaultPrevented).toBe(false);
  });

  it("saves, raises a toast, refreshes and is clean again", async () => {
    vi.mocked(updateVideoDetails).mockResolvedValue({ ok: true });
    render(<EditVideoForm videoId="v1" initial={blank} />);

    await userEvent.type(screen.getByLabelText("Title"), "Holiday");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Details saved"));
    expect(updateVideoDetails).toHaveBeenCalledWith("v1", { ...blank, title: "Holiday" });
    expect(refresh).toHaveBeenCalled();
    expect(reload().defaultPrevented).toBe(false);
  });

  it("puts the API's refusal on its field and keeps the form dirty", async () => {
    vi.mocked(updateVideoDetails).mockResolvedValue({
      ok: false,
      message: "The title can be at most 100 characters.",
    });
    render(<EditVideoForm videoId="v1" initial={blank} />);

    await userEvent.type(screen.getByLabelText("Title"), "Holiday");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    const title = screen.getByLabelText("Title");
    expect((await screen.findByRole("alert")).textContent).toBe("The title can be at most 100 characters.");
    expect(title.getAttribute("aria-invalid")).toBe("true");
    expect(toast.success).not.toHaveBeenCalled();
    expect(reload().defaultPrevented).toBe(true);
  });
});
