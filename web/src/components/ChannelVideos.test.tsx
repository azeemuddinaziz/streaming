// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChannelVideos } from "./ChannelVideos";

const getChannelVideos = vi.fn();
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  getChannelVideos: (...args: unknown[]) => getChannelVideos(...args),
}));

const video = (id: string, title: string) => ({ id, title, createdAt: "2026-10-01T00:00:00.000Z", thumbnailPath: null });

beforeEach(() => {
  getChannelVideos.mockReset();
  window.sessionStorage.clear();
});

describe("ChannelVideos", () => {
  it("shows the server's first page and appends the next on Load more, without duplicates", async () => {
    getChannelVideos.mockResolvedValue({
      ok: true,
      videos: [video("b", "Second"), video("c", "Third")],
      page: 2,
      hasMore: false,
    });
    render(<ChannelVideos channelName="Ada" videos={[video("a", "First"), video("b", "Second")]} hasMore />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(getChannelVideos).toHaveBeenCalledWith("Ada", 2);
    expect(await screen.findByText("Third")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
    expect(screen.getByText("You have reached the end.")).toBeInTheDocument();
  });

  it("offers Retry when a page cannot be loaded and keeps what is shown", async () => {
    getChannelVideos.mockResolvedValue({ ok: false });
    render(<ChannelVideos channelName="Ada" videos={[video("a", "First")]} hasMore />);

    await userEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("More videos could not be loaded.");
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
