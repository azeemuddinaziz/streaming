// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WatchLayout } from "./WatchLayout";

const slots = {
  player: <div role="group" aria-label="Video player" />,
  details: <h1>Title</h1>,
  suggested: <section aria-label="Suggested videos" />,
  comments: <section aria-label="Comments" />,
};

describe("WatchLayout", () => {
  it("keeps the small-screen reading order in the DOM: player, details, suggestions, Comments", () => {
    render(<WatchLayout {...slots} />);
    const order = [
      screen.getByRole("group", { name: "Video player" }),
      screen.getByRole("heading", { name: "Title" }),
      screen.getByRole("region", { name: "Suggested videos" }),
      screen.getByRole("region", { name: "Comments" }),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("is two columns from lg only when there are suggestions", () => {
    const { container, rerender } = render(<WatchLayout {...slots} />);
    expect(container.querySelector("article")?.className).toContain("lg:grid-cols-");

    rerender(<WatchLayout player={slots.player} details={slots.details} />);
    expect(container.querySelector("article")?.className).not.toContain("lg:grid-cols-");
    expect(screen.queryByRole("region")).toBeNull();
  });
});
