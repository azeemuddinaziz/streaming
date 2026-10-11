"use client";

import { EyeOffIcon, MessageSquareOffIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { deleteComment, editComment, setCommentHidden, type Comment } from "@/lib/api-client";
import { ReactionButtons } from "../ReactionButtons";
import { CommentField } from "./CommentField";

type Props = {
  videoId: string;
  signedIn: boolean;
  comment: Comment;
  onChanged: (comment: Comment) => void;
  onDeleted: () => void;
  // Given only to the Video's owner: shows Hide on a Comment that is not hidden.
  onHidden?: () => void;
  // Given, shows a Reply button.
  onReply?: () => void;
  // False while Comments are off: the author can still delete, not edit or react.
  canEdit: boolean;
  children?: React.ReactNode;
};

// One Comment or Reply. The text is rendered as a React text node, so markup
// and links in it are shown as written and never become elements. The author
// gets Edit and Delete (behind an AlertDialog); the Video's owner gets Hide.
export function CommentItem({
  videoId,
  signedIn,
  comment,
  onChanged,
  onDeleted,
  onHidden,
  onReply,
  canEdit,
  children,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.body ?? "");
  const [fieldError, setFieldError] = useState<string>();
  const [busy, setBusy] = useState<"saving" | "deleting" | "hiding">();
  const [message, setMessage] = useState<string>();
  const [confirming, setConfirming] = useState(false);

  if (comment.deleted) {
    return (
      <article className="grid gap-2" data-comment-id={comment.id}>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquareOffIcon className="size-4" aria-hidden="true" />
          This comment was deleted.
        </p>
        {children}
      </article>
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (text.trim() === "") return setFieldError("Write something before saving.");
    setBusy("saving");
    setFieldError(undefined);
    const result = await editComment(videoId, comment.id, text);
    setBusy(undefined);
    if (!result.ok) return setFieldError(result.message);
    setEditing(false);
    toast.success("Comment updated");
    onChanged(result.comment);
  }

  async function remove() {
    setBusy("deleting");
    setMessage(undefined);
    const result = await deleteComment(videoId, comment.id);
    setBusy(undefined);
    setConfirming(false);
    if (result.ok) {
      toast.success("Comment deleted");
      onDeleted();
    } else setMessage(result.message);
  }

  async function hide() {
    setBusy("hiding");
    setMessage(undefined);
    const result = await setCommentHidden(videoId, comment.id, true);
    setBusy(undefined);
    if (result.ok) {
      toast.success("Comment hidden");
      onHidden?.();
    } else setMessage(result.message);
  }

  const canHide = onHidden !== undefined && !comment.hidden;
  const showActions = !editing && (comment.isAuthor || canHide || (onReply && !comment.hidden));
  return (
    <article className="grid gap-2" data-comment-id={comment.id}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <strong className="text-foreground">{comment.authorName}</strong>
        {comment.isChannelOwner && <Badge variant="secondary">Channel owner</Badge>}
        {comment.hidden && (
          <Badge variant="outline">
            <EyeOffIcon aria-hidden="true" />
            Hidden
          </Badge>
        )}
        <span aria-hidden="true">·</span>
        <time dateTime={comment.createdAt}>
          {new Date(comment.createdAt).toLocaleDateString("en", { dateStyle: "medium" })}
        </time>
        {comment.edited && <span>(edited)</span>}
      </p>

      {editing ? (
        <form className="grid gap-3" onSubmit={save} noValidate>
          <CommentField
            label="Edit your comment"
            value={text}
            onChange={(value) => {
              setText(value);
              if (fieldError) setFieldError(undefined);
            }}
            error={fieldError}
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy !== undefined}>
              {busy === "saving" && <Spinner />}
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy !== undefined}
              onClick={() => {
                setEditing(false);
                setText(comment.body ?? "");
                setFieldError(undefined);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{comment.body}</p>
      )}

      {/* Reactions stop with Comments off and on a hidden Comment, which refuses them. */}
      {canEdit && !comment.hidden && !editing && (
        <ReactionButtons
          videoId={videoId}
          commentId={comment.id}
          signedIn={signedIn}
          likes={comment.likes}
          dislikes={comment.dislikes}
          myReaction={comment.myReaction}
        />
      )}

      {showActions && (
        <div className="flex flex-wrap gap-2">
          {onReply && !comment.hidden && (
            <Button type="button" variant="ghost" size="sm" onClick={onReply}>
              Reply
            </Button>
          )}
          {comment.isAuthor && canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setText(comment.body ?? "");
                setFieldError(undefined);
                setEditing(true);
              }}
            >
              Edit
            </Button>
          )}
          {comment.isAuthor && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)} disabled={busy !== undefined}>
              Delete
            </Button>
          )}
          {canHide && (
            <Button type="button" variant="ghost" size="sm" onClick={hide} disabled={busy !== undefined}>
              {busy === "hiding" && <Spinner />}
              Hide
            </Button>
          )}
        </div>
      )}

      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}

      <AlertDialog open={confirming} onOpenChange={(open) => busy !== "deleting" && setConfirming(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be gone for everyone. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "deleting"}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy === "deleting"}
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
            >
              {busy === "deleting" && <Spinner />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {children}
    </article>
  );
}
