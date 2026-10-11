// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const postComment = vi.fn();
vi.mock("@/lib/api-client", () => ({
  COMMENT_MAX: 1000,
  postComment: (...a: unknown[]) => postComment(...a),
}));

import { CommentComposer } from "./CommentComposer";

beforeEach(() => postComment.mockReset());

const comment = { id: "c1", body: "Hi" };

describe("CommentComposer", () => {
  it("counts characters against the limit", async () => {
    const user = userEvent.setup();
    render(<CommentComposer videoId="v1" label="Add a comment" onPosted={vi.fn()} />);
    expect(screen.getByText("0 / 1000")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Add a comment"), "hello");
    expect(screen.getByText("5 / 1000")).toBeInTheDocument();
  });

  it("refuses blank text inline without calling the API", async () => {
    const user = userEvent.setup();
    render(<CommentComposer videoId="v1" label="Add a comment" onPosted={vi.fn()} />);
    await user.type(screen.getByLabelText("Add a comment"), "   ");
    await user.click(screen.getByRole("button", { name: "Comment" }));

    expect(postComment).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Write something before posting.");
    expect(screen.getByLabelText("Add a comment")).toHaveAttribute("aria-invalid", "true");
  });

  it("posts, clears the field and reports the new Comment", async () => {
    const user = userEvent.setup();
    const onPosted = vi.fn();
    postComment.mockResolvedValue({ ok: true, comment });
    render(<CommentComposer videoId="v1" label="Add a comment" onPosted={onPosted} />);
    await user.type(screen.getByLabelText("Add a comment"), "Hi");
    await user.click(screen.getByRole("button", { name: "Comment" }));

    expect(postComment).toHaveBeenCalledWith("v1", { body: "Hi", parentId: undefined });
    expect(onPosted).toHaveBeenCalledWith(comment);
    expect(screen.getByLabelText("Add a comment")).toHaveValue("");
  });

  it("shows the rate-limit message inline and keeps the typed text", async () => {
    const user = userEvent.setup();
    const onPosted = vi.fn();
    postComment.mockResolvedValue({ ok: false, message: "Slow down: you can post again in 23 seconds. Your text is kept." });
    render(<CommentComposer videoId="v1" label="Add a comment" onPosted={onPosted} />);
    await user.type(screen.getByLabelText("Add a comment"), "Typed words");
    await user.click(screen.getByRole("button", { name: "Comment" }));

    expect(screen.getByRole("alert")).toHaveTextContent("you can post again in 23 seconds");
    expect(screen.getByLabelText("Add a comment")).toHaveValue("Typed words");
    expect(onPosted).not.toHaveBeenCalled();
  });

  it("posts a Reply under its parent and can be cancelled", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    postComment.mockResolvedValue({ ok: true, comment });
    render(<CommentComposer videoId="v1" parentId="p1" label="Reply to Ann" onPosted={vi.fn()} onCancel={onCancel} />);
    expect(screen.getByLabelText("Reply to Ann")).toHaveFocus();
    await user.type(screen.getByLabelText("Reply to Ann"), "Yes");
    await user.click(screen.getByRole("button", { name: "Reply" }));
    expect(postComment).toHaveBeenCalledWith("v1", { body: "Yes", parentId: "p1" });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
