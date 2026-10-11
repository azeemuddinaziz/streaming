// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioVideo } from "@/lib/api-client";
import { ProcessingPhases } from "./ProcessingPhases";
import { StudioVideoList } from "./StudioVideoList";
import { POLL_INTERVAL_MS } from "./useStudioPolling";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/DeleteVideoButton", () => ({ DeleteVideoButton: () => null }));
vi.mock("@/components/RetryButton", () => ({ RetryButton: () => null }));
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  fetchStudioPage: vi.fn(),
}));

import { toast } from "sonner";
import { fetchStudioPage } from "@/lib/api-client";

const video = (id: string, patch: Partial<StudioVideo> = {}): StudioVideo => ({
  id,
  label: `${id}.mp4`,
  title: null,
  description: null,
  status: "PROCESSING",
  processingProgress: null,
  visibility: "PRIVATE",
  commentsEnabled: true,
  likes: 0,
  dislikes: 0,
  createdAt: "2026-10-11T00:00:00.000Z",
  thumbnailPath: null,
  ...patch,
});

const page = (videos: StudioVideo[]) =>
  ({ ok: true, videos, page: 1, hasMore: false, total: videos.length }) as const;

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event("visibilitychange"));
}

// Moves fake time forward and lets the awaited fetch settle.
const advance = (ms: number) => act(async () => {
  await vi.advanceTimersByTimeAsync(ms);
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  setHidden(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ProcessingPhases", () => {
  it("shows labelled phases and a bar with a name and a value", () => {
    render(<ProcessingPhases label="holiday.mp4" progress={42} />);

    const bar = screen.getByRole("progressbar", { name: "Processing holiday.mp4" });
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
    expect(screen.getByText("42%")).toBeTruthy();
    expect(screen.getByText("Uploaded")).toBeTruthy();
    expect(screen.getByText("Ready")).toBeTruthy();
    expect(screen.getByText("Processing").closest("li")?.getAttribute("aria-current")).toBe("step");
  });

  it("says Starting… with no value while the progress is null", () => {
    render(<ProcessingPhases label="holiday.mp4" progress={null} />);

    const bar = screen.getByRole("progressbar", { name: "Processing holiday.mp4" });
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    expect(screen.getByText("Starting…")).toBeTruthy();
  });
});

describe("StudioVideoList polling", () => {
  it("updates a row in place without a refresh while a Video is processing", async () => {
    vi.mocked(fetchStudioPage).mockResolvedValue(page([video("a", { processingProgress: 60 })]));
    render(<StudioVideoList videos={[video("a")]} page={1} status={undefined} />);
    expect(screen.getByText("Starting…")).toBeTruthy();

    await advance(POLL_INTERVAL_MS);

    expect(fetchStudioPage).toHaveBeenCalledWith({ page: 1, status: undefined });
    expect(screen.getByText("60%")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("keeps polling each tick, then stops once nothing is processing", async () => {
    vi.mocked(fetchStudioPage)
      .mockResolvedValueOnce(page([video("a", { processingProgress: 30 })]))
      .mockResolvedValueOnce(page([video("a", { status: "READY", processingProgress: 100 })]));
    render(<StudioVideoList videos={[video("a")]} page={2} status="PROCESSING" />);

    await advance(POLL_INTERVAL_MS);
    await advance(POLL_INTERVAL_MS);
    expect(fetchStudioPage).toHaveBeenCalledTimes(2);
    expect(fetchStudioPage).toHaveBeenLastCalledWith({ page: 2, status: "PROCESSING" });

    await advance(POLL_INTERVAL_MS * 5);
    expect(fetchStudioPage).toHaveBeenCalledTimes(2);
  });

  it("raises a toast, a polite announcement and a server refresh when a Video finishes", async () => {
    vi.mocked(fetchStudioPage).mockResolvedValue(
      page([video("a", { status: "READY", processingProgress: 100 }), video("b", { status: "FAILED" })]),
    );
    render(<StudioVideoList videos={[video("a"), video("b")]} page={1} status={undefined} />);

    await advance(POLL_INTERVAL_MS);

    expect(toast.success).toHaveBeenCalledWith("a.mp4 is ready");
    expect(toast.error).toHaveBeenCalledWith("b.mp4 could not be processed");
    expect(refresh).toHaveBeenCalledTimes(1);
    const live = screen.getByRole("status");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toBe("a.mp4 is ready. b.mp4 failed to process.");
  });

  it("does not announce progress ticks", async () => {
    vi.mocked(fetchStudioPage).mockResolvedValue(page([video("a", { processingProgress: 10 })]));
    render(<StudioVideoList videos={[video("a")]} page={1} status={undefined} />);

    await advance(POLL_INTERVAL_MS);

    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("never polls when nothing is processing", async () => {
    render(<StudioVideoList videos={[video("a", { status: "READY" })]} page={1} status={undefined} />);

    await advance(POLL_INTERVAL_MS * 3);

    expect(fetchStudioPage).not.toHaveBeenCalled();
  });

  it("pauses while the tab is hidden, and checks at once on return", async () => {
    vi.mocked(fetchStudioPage).mockResolvedValue(page([video("a", { processingProgress: 20 })]));
    render(<StudioVideoList videos={[video("a")]} page={1} status={undefined} />);

    act(() => setHidden(true));
    await advance(POLL_INTERVAL_MS * 5);
    expect(fetchStudioPage).not.toHaveBeenCalled();

    act(() => setHidden(false));
    await advance(0);
    expect(fetchStudioPage).toHaveBeenCalledTimes(1);
    await advance(POLL_INTERVAL_MS);
    expect(fetchStudioPage).toHaveBeenCalledTimes(2);
  });

  it("keeps the rows and tries again when a poll fails", async () => {
    vi.mocked(fetchStudioPage)
      .mockResolvedValueOnce({ ok: false, reason: "unavailable" })
      .mockResolvedValueOnce(page([video("a", { processingProgress: 70 })]));
    render(<StudioVideoList videos={[video("a")]} page={1} status={undefined} />);

    await advance(POLL_INTERVAL_MS);
    expect(screen.getByText("Starting…")).toBeTruthy();
    await advance(POLL_INTERVAL_MS);

    expect(screen.getByText("70%")).toBeTruthy();
  });
});
