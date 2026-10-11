// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getReplies = vi.fn();
vi.mock("@/lib/api-client", () => ({
  COMMENT_MAX: 1000,
  getReplies: (...a: unknown[]) => getReplies(...a),
  postComment: vi.fn(),
  editComment: vi.fn(),
  deleteComment: vi.fn(),
  setCommentHidden: vi.fn(),
  reactToComment: vi.fn(),
  reactToVideo: vi.fn(),
}));

import type { Comment } from "@/lib/api-client";
import { CommentThread } from "./CommentThread";

const make = (over: Partial<Comment>): Comment => ({
  id: "c1",
  parentId: null,
  body: "Top",
  authorName: "ann",
  isChannelOwner: false,
  isAuthor: false,
  edited: false,
  hidden: false,
  deleted: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  replyCount: 2,
  likes: 0,
  myReaction: null,
  ...over,
});

const reply = (id: string, body: string) => make({ id, parentId: "c1", body, replyCount: 0 });

function setup(comment = make({}), canWrite = true) {
  return render(
    <CommentThread
      videoId="v1"
      signedIn
      comment={comment}
      canWrite={canWrite}
      canEdit
      isOwner={false}
      onChanged={vi.fn()}
      onDeleted={vi.fn()}
      onReplyPosted={vi.fn()}
      onReplyDeleted={vi.fn()}
      onReplyHidden={vi.fn()}
    />,
  );
}

beforeEach(() => getReplies.mockReset());

describe("CommentThread", () => {
  it("loads Replies on first expand only, then toggles without fetching", async () => {
    const user = userEvent.setup();
    getReplies.mockResolvedValue({ ok: true, replies: [reply("r1", "First"), reply("r2", "Second")] });
    setup();
    expect(getReplies).not.toHaveBeenCalled();

    const toggle = screen.getByRole("button", { name: "Show 2 replies" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(await screen.findByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(getReplies).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Hide 2 replies" }));
    expect(screen.queryByText("First")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show 2 replies" }));
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(getReplies).toHaveBeenCalledTimes(1);
  });

  it("shows an error row with Retry when loading fails, then recovers", async () => {
    const user = userEvent.setup();
    getReplies.mockResolvedValueOnce({ ok: false, message: "Could not load." });
    getReplies.mockResolvedValueOnce({ ok: true, replies: [reply("r1", "First")] });
    setup(make({ replyCount: 1 }));
    await user.click(screen.getByRole("button", { name: "Show 1 reply" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load.");

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("First")).toBeInTheDocument();
    expect(getReplies).toHaveBeenCalledTimes(2);
  });

  it("has no expand button without Replies", () => {
    setup(make({ replyCount: 0 }));
    expect(screen.queryByRole("button", { name: /^(Show|Hide) \d+ repl/ })).not.toBeInTheDocument();
  });

  it("offers Reply only to someone who can write, and not on a deleted placeholder", () => {
    const { unmount } = setup(make({}), false);
    expect(screen.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument();
    unmount();
    const { unmount: again } = setup(make({ deleted: true, body: null, authorName: null }));
    expect(screen.getByText("This comment was deleted.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show 2 replies" })).toBeInTheDocument();
    again();
    setup();
    expect(screen.getByRole("button", { name: "Reply" })).toBeInTheDocument();
  });
});
