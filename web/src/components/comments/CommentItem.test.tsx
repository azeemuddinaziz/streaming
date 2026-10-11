// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteComment = vi.fn();
const setCommentHidden = vi.fn();
const editComment = vi.fn();
vi.mock("@/lib/api-client", () => ({
  COMMENT_MAX: 1000,
  deleteComment: (...a: unknown[]) => deleteComment(...a),
  setCommentHidden: (...a: unknown[]) => setCommentHidden(...a),
  editComment: (...a: unknown[]) => editComment(...a),
  reactToComment: vi.fn(),
  reactToVideo: vi.fn(),
}));

import type { Comment } from "@/lib/api-client";
import { CommentItem } from "./CommentItem";

const make = (over: Partial<Comment> = {}): Comment => ({
  id: "c1",
  parentId: null,
  body: "Hello <b>there</b>",
  authorName: "ann",
  isChannelOwner: false,
  isAuthor: true,
  edited: false,
  hidden: false,
  deleted: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  replyCount: 0,
  likes: 0,
  myReaction: null,
  ...over,
});

beforeEach(() => {
  deleteComment.mockReset();
  setCommentHidden.mockReset();
  editComment.mockReset();
});

function setup(comment: Comment, extra: Partial<React.ComponentProps<typeof CommentItem>> = {}) {
  const props = { onChanged: vi.fn(), onDeleted: vi.fn(), ...extra };
  render(<CommentItem videoId="v1" signedIn comment={comment} canEdit {...props} />);
  return props;
}

describe("CommentItem", () => {
  it("shows text as written, never as markup", () => {
    setup(make());
    expect(screen.getByText("Hello <b>there</b>")).toBeInTheDocument();
  });

  it("marks edited and Channel owner in words", () => {
    setup(make({ edited: true, isChannelOwner: true }));
    expect(screen.getByText("(edited)")).toBeInTheDocument();
    expect(screen.getByText("Channel owner")).toBeInTheDocument();
  });

  it("asks in an AlertDialog before deleting, and deletes on confirm", async () => {
    const user = userEvent.setup();
    deleteComment.mockResolvedValue({ ok: true });
    const { onDeleted } = setup(make());
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(deleteComment).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(deleteComment).toHaveBeenCalledWith("v1", "c1");
    expect(onDeleted).toHaveBeenCalled();
  });

  it("keeps the Comment when the delete dialog is cancelled", async () => {
    const user = userEvent.setup();
    const { onDeleted } = setup(make());
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(deleteComment).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("edits in place and reports the saved Comment", async () => {
    const user = userEvent.setup();
    const saved = make({ body: "New", edited: true });
    editComment.mockResolvedValue({ ok: true, comment: saved });
    const { onChanged } = setup(make());
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const field = screen.getByLabelText("Edit your comment");
    await user.clear(field);
    await user.type(field, "New");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(editComment).toHaveBeenCalledWith("v1", "c1", "New");
    expect(onChanged).toHaveBeenCalledWith(saved);
  });

  it("offers Hide only when given, and not on a hidden Comment", async () => {
    const user = userEvent.setup();
    setCommentHidden.mockResolvedValue({ ok: true });
    const onHidden = vi.fn();
    setup(make({ isAuthor: false }), { onHidden });
    await user.click(screen.getByRole("button", { name: "Hide" }));
    expect(setCommentHidden).toHaveBeenCalledWith("v1", "c1", true);
    expect(onHidden).toHaveBeenCalled();
  });

  it("shows a deleted placeholder with text and no actions", () => {
    setup(make({ deleted: true, body: null, authorName: null, isAuthor: false }));
    expect(screen.getByText("This comment was deleted.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("labels a hidden Comment with a badge and offers no reactions", () => {
    setup(make({ hidden: true }));
    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "React to this comment" })).not.toBeInTheDocument();
  });
});
