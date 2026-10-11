"use client";

import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getReplies, type Comment } from "@/lib/api-client";
import { CommentComposer } from "./CommentComposer";
import { CommentItem } from "./CommentItem";

type Props = {
  videoId: string;
  signedIn: boolean;
  comment: Comment;
  // Signed in, with Comments on: the Reply buttons show.
  canWrite: boolean;
  canEdit: boolean;
  isOwner: boolean;
  onChanged: (comment: Comment) => void;
  onDeleted: () => void;
  onHidden?: () => void;
  onReplyPosted: () => void;
  onReplyDeleted: () => void;
  onReplyHidden: () => void;
};

// A top-level Comment with its Replies. Replies are fetched all at once the
// first time "Show N replies" opens, and kept for later toggles.
export function CommentThread({
  videoId,
  signedIn,
  comment,
  canWrite,
  canEdit,
  isOwner,
  onChanged,
  onDeleted,
  onHidden,
  onReplyPosted,
  onReplyDeleted,
  onReplyHidden,
}: Props) {
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState<Comment[]>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  // The author being answered, while the Reply form is open.
  const [answering, setAnswering] = useState<string>();

  async function load() {
    setLoading(true);
    setError(undefined);
    const result = await getReplies(videoId, comment.id);
    setLoading(false);
    if (result.ok) setReplies(result.replies);
    else setError(result.message);
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !replies) await load();
  }

  const replyCount = `${comment.replyCount} ${comment.replyCount === 1 ? "reply" : "replies"}`;
  // A deleted placeholder is closed to new Replies, but its old ones stay readable.
  const canAnswer = canWrite && !comment.deleted;

  return (
    <CommentItem
      videoId={videoId}
      signedIn={signedIn}
      comment={comment}
      canEdit={canEdit}
      onChanged={onChanged}
      onDeleted={onDeleted}
      onHidden={onHidden}
      onReply={canAnswer ? () => setAnswering(comment.authorName ?? "") : undefined}
    >
      {comment.replyCount > 0 && (
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={toggle} aria-expanded={open}>
            {open ? <ChevronUpIcon aria-hidden="true" /> : <ChevronDownIcon aria-hidden="true" />}
            {open ? `Hide ${replyCount}` : `Show ${replyCount}`}
          </Button>
        </div>
      )}

      {open && (
        <div className="grid gap-4 border-l pl-4">
          {loading && (
            <div role="status" aria-busy="true" aria-label="Loading replies" className="grid gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-3/4 max-w-sm" />
            </div>
          )}
          {error && (
            <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
              {error}
              <Button type="button" variant="outline" size="sm" onClick={load}>
                Retry
              </Button>
            </div>
          )}
          {replies?.map((reply) => (
            <CommentItem
              key={reply.id}
              videoId={videoId}
              signedIn={signedIn}
              comment={reply}
              canEdit={canEdit}
              onChanged={(changed) =>
                setReplies((current) => current?.map((item) => (item.id === changed.id ? changed : item)))
              }
              onDeleted={() => {
                setReplies((current) => current?.filter((item) => item.id !== reply.id));
                onReplyDeleted();
              }}
              onHidden={
                isOwner
                  ? () => {
                      setReplies((current) => current?.filter((item) => item.id !== reply.id));
                      onReplyHidden();
                    }
                  : undefined
              }
              onReply={canAnswer ? () => setAnswering(reply.authorName ?? "") : undefined}
            />
          ))}
        </div>
      )}

      {answering !== undefined && (
        <CommentComposer
          videoId={videoId}
          parentId={comment.id}
          label={`Reply to ${answering}`}
          onCancel={() => setAnswering(undefined)}
          onPosted={async (reply) => {
            setAnswering(undefined);
            setOpen(true);
            setReplies((current) => (current ? [...current, reply] : current));
            if (!replies) await load();
            onReplyPosted();
          }}
        />
      )}
    </CommentItem>
  );
}
