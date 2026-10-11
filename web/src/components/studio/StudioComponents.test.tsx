// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteVideoButton } from "@/components/DeleteVideoButton";
import { RetryButton } from "@/components/RetryButton";
import { StatusBadge } from "./StatusBadge";
import { StudioFilter } from "./StudioFilter";
import { StudioPagination } from "./StudioPagination";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api-client", () => ({ deleteVideo: vi.fn(), retryVideo: vi.fn() }));

import { toast } from "sonner";
import { deleteVideo, retryVideo } from "@/lib/api-client";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("StatusBadge", () => {
  it("says the status in words, with an icon, for each status", () => {
    const { container } = render(
      <>
        <StatusBadge status="PROCESSING" />
        <StatusBadge status="READY" />
        <StatusBadge status="FAILED" />
      </>,
    );
    for (const word of ["Processing", "Ready", "Failed"]) expect(screen.getByText(word)).toBeTruthy();
    expect(container.querySelectorAll("svg")).toHaveLength(3);
  });
});

describe("StudioFilter", () => {
  it("keeps the choice in links and marks the current one", () => {
    render(<StudioFilter status="FAILED" />);

    expect(screen.getByRole("link", { name: "Failed" }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("link", { name: "All" }).getAttribute("href")).toBe("/studio");
    expect(screen.getByRole("link", { name: "Ready" }).getAttribute("href")).toBe("/studio?status=ready");
  });
});

describe("StudioPagination", () => {
  it("renders nothing for one page", () => {
    const { container } = render(<StudioPagination page={1} total={24} status={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("links numbered pages, keeps the filter and marks the current page", () => {
    render(<StudioPagination page={2} total={80} status="READY" />);

    expect(screen.getByRole("link", { name: "Page 2" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Page 3" }).getAttribute("href")).toBe("/studio?status=ready&page=3");
    expect(screen.getByRole("link", { name: /Previous/ }).getAttribute("href")).toBe("/studio?status=ready");
    expect(screen.getByRole("link", { name: /Next/ }).getAttribute("href")).toBe("/studio?status=ready&page=3");
  });
});

describe("DeleteVideoButton", () => {
  it("asks first, and a cancel deletes nothing", async () => {
    const user = userEvent.setup();
    render(<DeleteVideoButton videoId="v1" label="holiday.mp4" />);

    await user.click(screen.getByRole("button", { name: "Delete holiday.mp4" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(deleteVideo).not.toHaveBeenCalled();
  });

  it("deletes on confirm, with a toast and a refresh", async () => {
    vi.mocked(deleteVideo).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<DeleteVideoButton videoId="v1" label="holiday.mp4" />);

    await user.click(screen.getByRole("button", { name: "Delete holiday.mp4" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(deleteVideo).toHaveBeenCalledWith("v1");
    expect(toast.success).toHaveBeenCalledWith('Deleted "holiday.mp4"');
  });

  it("keeps the dialog open and says why when it fails", async () => {
    vi.mocked(deleteVideo).mockResolvedValue({ ok: false, message: "Video not found." });
    const user = userEvent.setup();
    render(<DeleteVideoButton videoId="v1" label="holiday.mp4" />);

    await user.click(screen.getByRole("button", { name: "Delete holiday.mp4" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Video not found.");
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("RetryButton", () => {
  it("shows it is working, then refreshes the list", async () => {
    let finish!: (value: { ok: true }) => void;
    vi.mocked(retryVideo).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    render(<RetryButton videoId="v1" label="holiday.mp4" />);

    await user.click(screen.getByRole("button", { name: "Retry holiday.mp4" }));
    const pending = screen.getByRole("button", { name: /Retrying/ }) as HTMLButtonElement;
    expect(pending.disabled).toBe(true);

    finish({ ok: true });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows the refusal beside the button", async () => {
    vi.mocked(retryVideo).mockResolvedValue({ ok: false, message: "Only a failed video can be retried." });
    const user = userEvent.setup();
    render(<RetryButton videoId="v1" />);

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Only a failed video can be retried.");
  });
});
