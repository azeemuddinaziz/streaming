"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  COMMENT_MAX,
  deleteComment,
  editComment,
  getComments,
  getReplies,
  postComment,
  type Comment,
} from "@/lib/api-client";

type Props = { videoId: string; initialCount: number; signedIn: boolean };

// One Comment or Reply. The text is rendered as a React text node, so markup
// and links in it are shown as written and never become elements. The author
// gets Edit and Delete here, with inline validation and a saved state.
function CommentView({
  videoId,
  comment,
  onChanged,
  onDeleted,
  children,
}: {
  videoId: string;
  comment: Comment;
  onChanged: (comment: Comment) => void;
  onDeleted: () => void;
  children?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.body ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [saved, setSaved] = useState(false);

  if (comment.deleted) {
    return (
      <article className="comment">
        <p className="hint">This comment was deleted.</p>
        {children}
      </article>
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (text.trim() === "") return setMessage("Write something before saving.");
    setBusy(true);
    setMessage(undefined);
    const result = await editComment(videoId, comment.id, text);
    setBusy(false);
    if (!result.ok) return setMessage(result.message);
    setEditing(false);
    setSaved(true);
    onChanged(result.comment);
  }

  async function remove() {
    if (!window.confirm("Delete this comment? This cannot be undone.")) return;
    setBusy(true);
    setMessage(undefined);
    const result = await deleteComment(videoId, comment.id);
    setBusy(false);
    if (result.ok) onDeleted();
    else setMessage(result.message);
  }

  const editId = `edit-${comment.id}`;
  return (
    <article className="comment">
      <p className="hint">
        <strong>{comment.authorName}</strong>
        {comment.isChannelOwner && <>{" "}<span className="badge">Channel owner</span></>}
        {" · "}
        <time dateTime={comment.createdAt}>
          {new Date(comment.createdAt).toLocaleDateString("en", { dateStyle: "medium" })}
        </time>
        {comment.edited && " · edited"}
      </p>
      {editing ? (
        <form className="form comment-form" onSubmit={save}>
          <div className="field">
            <label htmlFor={editId}>Edit your comment</label>
            <textarea
              id={editId}
              rows={3}
              maxLength={COMMENT_MAX}
              value={text}
              onChange={(event) => setText(event.target.value)}
              autoFocus
            />
            <p className="hint">
              {text.length} / {COMMENT_MAX}
            </p>
          </div>
          <div className="comment-actions">
            <button className="button" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              className="button button-secondary"
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setText(comment.body ?? "");
                setMessage(undefined);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="comment-body">{comment.body}</p>
      )}
      {comment.isAuthor && !editing && (
        <div className="comment-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              setText(comment.body ?? "");
              setSaved(false);
              setEditing(true);
            }}
          >
            Edit
          </button>
          <button className="button button-secondary" type="button" onClick={remove} disabled={busy}>
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      )}
      {saved && !editing && <p role="status" className="hint">Saved.</p>}
      {message && <p role="alert" className="form-error">{message}</p>}
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
  onReplyDeleted,
}: {
  videoId: string;
  comment: Comment;
  signedIn: boolean;
  onPosted: () => void;
  onReplyDeleted: () => void;
}) {
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

  return (
    <div className="replies">
      <div className="comment-actions">
        {comment.replyCount > 0 && (
          <button className="button button-secondary" type="button" onClick={toggle} aria-expanded={open}>
            {open ? "Hide" : "Show"} {comment.replyCount} {comment.replyCount === 1 ? "reply" : "replies"}
          </button>
        )}
        {signedIn && !comment.deleted && answering === undefined && (
          <button
            className="button button-secondary"
            type="button"
            onClick={() => setAnswering(comment.authorName ?? "")}
          >
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
            <CommentView
              key={reply.id}
              videoId={videoId}
              comment={reply}
              onChanged={(changed) =>
                setReplies((current) => current?.map((item) => (item.id === changed.id ? changed : item)))
              }
              onDeleted={() => {
                setReplies((current) => current?.filter((item) => item.id !== reply.id));
                onReplyDeleted();
              }}
            >
              {signedIn && !comment.deleted && (
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setAnswering(reply.authorName ?? "")}
                >
                  Reply
                </button>
              )}
            </CommentView>
          ))}
        </div>
      )}
      {answering !== undefined && (
        <CommentForm
          videoId={videoId}
          parentId={comment.id}
          label={`Reply to ${answering}`}
          onCancel={() => setAnswering(undefined)}
          onPosted={async (reply) => {
            setAnswering(undefined);
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
          <CommentView
            key={comment.id}
            videoId={videoId}
            comment={comment}
            onChanged={(changed) =>
              setComments((current) =>
                current.map((item) => (item.id === changed.id ? { ...changed, replyCount: item.replyCount } : item)),
              )
            }
            onDeleted={() => {
              setCount((current) => current - 1);
              // With Replies it stays as a placeholder; without, it disappears.
              setComments((current) =>
                comment.replyCount > 0
                  ? current.map((item) => (item.id === comment.id ? { ...item, deleted: true, isAuthor: false } : item))
                  : current.filter((item) => item.id !== comment.id),
              );
            }}
          >
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
              onReplyDeleted={() => {
                setCount((current) => current - 1);
                // A placeholder goes with its last Reply.
                setComments((current) =>
                  current.flatMap((item) => {
                    if (item.id !== comment.id) return [item];
                    const replyCount = item.replyCount - 1;
                    return item.deleted && replyCount === 0 ? [] : [{ ...item, replyCount }];
                  }),
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
