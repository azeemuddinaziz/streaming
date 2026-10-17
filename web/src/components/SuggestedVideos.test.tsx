// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SuggestedVideos } from "./SuggestedVideos";

const getPublicVideos = vi.fn();
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  getPublicVideos: (...args: unknown[]) => getPublicVideos(...args),
}));

const video = (n: number) => ({
  id: `v${n}`,
  title: `Video ${n}`,
  createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  channelName: `Channel ${n}`,
  thumbnailPath: null,
});

// An async server component renders to an element once awaited.
async function renderSuggestions(currentId = "v1") {
  render(await SuggestedVideos({ currentId }));
}

beforeEach(() => {
  getPublicVideos.mockReset();
});

describe("SuggestedVideos", () => {
  it("is a section named Suggested videos", async () => {
    getPublicVideos.mockResolvedValue({ ok: true, videos: [video(2)], page: 1, hasMore: false });
    await renderSuggestions();
    expect(screen.getByRole("region", { name: "Suggested videos" })).toBeInTheDocument();
  });

  it("lists each Video with its title, Channel name and relative date, linked", async () => {
    getPublicVideos.mockResolvedValue({ ok: true, videos: [video(2), video(3)], page: 1, hasMore: false });
    await renderSuggestions();

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    const first = within(items[0]);
    expect(first.getByRole("link", { name: "Video 2" })).toHaveAttribute("href", "/watch/v2");
    expect(first.getByRole("link", { name: "Channel 2" })).toHaveAttribute("href", "/channels/Channel%202");
    expect(first.getByText("2 days ago")).toBeInTheDocument();
    expect(getPublicVideos).toHaveBeenCalledWith(1);
  });

  it("leaves out the Video being watched and shows at most 12", async () => {
    getPublicVideos.mockResolvedValue({
      ok: true,
      videos: Array.from({ length: 24 }, (_, i) => video(i + 1)),
      page: 1,
      hasMore: false,
    });
    await renderSuggestions("v3");

    expect(screen.getAllByRole("listitem")).toHaveLength(12);
    expect(screen.queryByText("Video 3")).not.toBeInTheDocument();
    expect(screen.getByText("Video 13")).toBeInTheDocument();
    expect(screen.queryByText("Video 14")).not.toBeInTheDocument();
  });

  it("says so when there is nothing else to watch", async () => {
    getPublicVideos.mockResolvedValue({ ok: true, videos: [video(1)], page: 1, hasMore: false });
    await renderSuggestions("v1");

    expect(screen.getByText("No other videos yet.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows an inline error with Try again back to the same page when the list cannot load", async () => {
    getPublicVideos.mockResolvedValue({ ok: false });
    await renderSuggestions("v7");

    const region = screen.getByRole("region", { name: "Suggested videos" });
    expect(within(region).getByRole("alert")).toHaveTextContent("Couldn't load suggestions");
    expect(within(region).getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/watch/v7");
  });
});
