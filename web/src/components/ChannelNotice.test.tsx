// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChannelNotice } from "./ChannelNotice";

describe("ChannelNotice", () => {
  it("says an unknown name is not found and links home", () => {
    render(<ChannelNotice kind="not-found" name="nobody" />);
    expect(screen.getByRole("heading", { name: "Channel not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to StreamSouk" })).toHaveAttribute("href", "/");
  });

  it("is an alert with a way to try again when the API does not answer", () => {
    render(<ChannelNotice kind="unavailable" name="Ada Lovelace" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load this channel");
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/channels/Ada%20Lovelace");
  });
});
