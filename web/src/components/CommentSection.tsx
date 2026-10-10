"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  COMMENT_MAX,
  getComments,
  getReplies,
  postComment,
  type Comment,
} from "@/lib/api-client";

type Props = { videoId: string; initialCount: number; signedIn: boolean };

// The Comment text is rendered as a React text node, so markup and links in it
// are shown as written and never become elements.
function CommentView({ comment, children }: { comment: Comment; children?: React.ReactNode }) {
  return (
    <article className="comment">
      <p className="hint">
        <strong>{comment.authorName}</strong>
        {comment.isChannelOwner && <span className="badge"> Channel owner</span>}
        {" · "}
        <time dateTime={comment.createdAt}>
          {new Date(comment.createdAt).toLocaleDateString("en", { dateStyle: "medium" })}
        </time>
      </p>
      <p className="comment-body">{comment.body}</p>
      {children}
    </article>
  );
}

function CommentForm({
  videoId,
  parentId,
  label,
  onPosted,
  onCancel,
}: {
  videoId: string;
  parentId?: string;
  label: string;
  onPosted: (comment: Comment) => void;
  onCancel?: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const field = useRef<HTMLTextAreaElement>(null);
  const id = `comment-${parentId ?? "new"}`;

  useEffect(() => {
    if (onCancel) field.current?.focus();
  }, [onCancel]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (text.trim() === "") return setMessage("Write something before posting.");
    setBusy(true);
    setMessage(undefined);
    const result = await postComment(videoId, { body: text, parentId });
    setBusy(false);
    if (!result.ok) return setMessage(result.message);
    setText("");
    onPosted(result.comment);
  }

  return (
    <form className="form comment-form" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <textarea
          id={id}
          ref={field}
          rows={parentId ? 2 : 3}
          maxLength={COMMENT_MAX}
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-describedby={`${id}-hint`}
        />
        <p className="hint" id={`${id}-hint`}>
          {text.length} / {COMMENT_MAX}
        </p>
      </div>
      <div className="comment-actions">
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Posting…" : parentId ? "Reply" : "Comment"}
        </button>
        {onCancel && (
          <button className="button button-secondary" type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      {message && <p role="alert" className="form-error">{message}</p>}
    </form>
  );
}

function Replies({
  videoId,
  comment,
  signedIn,
  onPosted,
}: {
  videoId: string;
  comment: Comment;
  signedIn: boolean;
  onPosted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState<Comment[]>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [answering, setAnswering] = useState(false);

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

  return (
    <div className="replies">
      <div className="comment-actions">
        {comment.replyCount > 0 && (
          <button className="button button-secondary" type="button" onClick={toggle} aria-expanded={open}>
            {open ? "Hide" : "Show"} {comment.replyCount} {comment.replyCount === 1 ? "reply" : "replies"}
          </button>
        )}
        {signedIn && !answering && (
          <button className="button button-secondary" type="button" onClick={() => setAnswering(true)}>
            Reply
          </button>
        )}
      </div>
      {open && (
        <div className="reply-list">
          {loading && <p role="status" className="hint">Loading replies…</p>}
          {error && (
            <p role="alert" className="form-error">
              {error}{" "}
              <button className="button button-secondary" type="button" onClick={load}>
                Try again
              </button>
            </p>
          )}
          {replies?.map((reply) => (
            <CommentView key={reply.id} comment={reply}>
              {signedIn && (
                <button className="button button-secondary" type="button" onClick={() => setAnswering(true)}>
                  Reply
                </button>
              )}
            </CommentView>
          ))}
        </div>
      )}
      {answering && (
        <CommentForm
          videoId={videoId}
          parentId={comment.id}
          label={`Reply to ${comment.authorName}`}
          onCancel={() => setAnswering(false)}
          onPosted={async (reply) => {
            setAnswering(false);
            setOpen(true);
            setReplies((current) => (current ? [...current, reply] : current));
            if (!replies) await load();
            onPosted();
          }}
        />
      )}
    </div>
  );
}

export function CommentSection({ videoId, initialCount, signedIn }: Props) {
  const [count, setCount] = useState(initialCount);
  const [comments, setComments] = useState<Comment[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [loaded, setLoaded] = useState(false);

  async function loadNext(next = page + 1) {
    setLoading(true);
    setError(undefined);
    const result = await getComments(videoId, next);
    setLoading(false);
    if (!result.ok) return setError(result.message);
    setComments((current) => {
      const seen = new Set(current.map((comment) => comment.id));
      return [...current, ...result.comments.filter((comment) => !seen.has(comment.id))];
    });
    setPage(next);
    setHasMore(result.hasMore);
    setLoaded(true);
  }

  useEffect(() => {
    void loadNext(1);
    // Loads the first page once per Video.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  return (
    <section className="comments" aria-labelledby="comments-heading">
      <h2 id="comments-heading">
        {count.toLocaleString("en")} {count === 1 ? "comment" : "comments"}
      </h2>

      {signedIn ? (
        <CommentForm
          videoId={videoId}
          label="Add a comment"
          onPosted={(comment) => {
            setComments((current) => [comment, ...current]);
            setCount((current) => current + 1);
          }}
        />
      ) : (
        <p className="hint">
          <Link href="/sign-in">Sign in</Link> to write a comment.
        </p>
      )}

      {error && (
        <p role="alert" className="form-error">
          {error}{" "}
          <button className="button button-secondary" type="button" onClick={() => loadNext()}>
            Try again
          </button>
        </p>
      )}
      {loading && <p role="status" className="hint">Loading comments…</p>}
      {loaded && comments.length === 0 && !error && (
        <p className="hint">No comments yet. Be the first to write one.</p>
      )}

      <div className="comment-list">
        {comments.map((comment) => (
          <CommentView key={comment.id} comment={comment}>
            <Replies
              videoId={videoId}
              comment={comment}
              signedIn={signedIn}
              onPosted={() => {
                setCount((current) => current + 1);
                setComments((current) =>
                  current.map((item) =>
                    item.id === comment.id ? { ...item, replyCount: item.replyCount + 1 } : item,
                  ),
                );
              }}
            />
          </CommentView>
        ))}
      </div>

      {hasMore && !loading && (
        <button className="button button-secondary" type="button" onClick={() => loadNext()}>
          Load more comments
        </button>
      )}
    </section>
  );
}
