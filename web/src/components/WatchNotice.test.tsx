// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrivateBadge, WatchNotice } from "./WatchNotice";

describe("WatchNotice", () => {
  it("labels each state with its own heading", () => {
    const headings = (["processing", "failed", "not-found", "unavailable"] as const).map((kind) => {
      const { unmount } = render(<WatchNotice kind={kind} />);
      const text = screen.getByRole("heading").textContent;
      unmount();
      return text;
    });
    expect(headings).toEqual([
      "Still processing",
      "Processing failed",
      "Video not found",
      "Could not load this video",
    ]);
  });

  it("sends the owner of a failed Video to the studio", () => {
    render(<WatchNotice kind="failed" />);
    expect(screen.getByRole("link", { name: /retry it from your studio/i })).toHaveAttribute("href", "/studio");
  });

  it("says a missing Video may be private, without revealing which", () => {
    render(<WatchNotice kind="not-found" />);
    expect(screen.getByText(/does not exist, or it is private/i)).toBeInTheDocument();
  });

  it("uses h2 beside a Video's own title and h1 when it is the page", () => {
    render(<WatchNotice kind="processing" />);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  it("announces a failed load as an alert", () => {
    render(<WatchNotice kind="unavailable" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

describe("PrivateBadge", () => {
  it("says it in words", () => {
    render(<PrivateBadge />);
    expect(screen.getByText(/only you can watch this/i)).toBeInTheDocument();
  });
});
