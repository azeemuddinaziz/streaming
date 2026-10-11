// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DescriptionBox, needsCollapse } from "./DescriptionBox";

describe("needsCollapse", () => {
  it("keeps a short description open", () => {
    expect(needsCollapse("Short and sweet")).toBe(false);
  });
  it("collapses a long one and one with many lines", () => {
    expect(needsCollapse("x".repeat(200))).toBe(true);
    expect(needsCollapse("a\nb\nc")).toBe(true);
  });
});

describe("DescriptionBox", () => {
  it("shows views and date, singular for one", () => {
    render(<DescriptionBox views={1} date="Oct 11, 2026" description={null} />);
    expect(screen.getByText("1 view · Oct 11, 2026")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("expands and collapses a long description from the keyboard", async () => {
    const user = userEvent.setup();
    render(<DescriptionBox views={1200} date="Oct 11, 2026" description={"word ".repeat(60)} />);
    const toggle = screen.getByRole("button", { name: "Show more" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    toggle.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("1,200 views · Oct 11, 2026")).toBeInTheDocument();
  });

  it("has no toggle for a short description", () => {
    render(<DescriptionBox views={3} date="Oct 11, 2026" description="Hello" />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
