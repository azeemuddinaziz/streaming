"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { postComment, type Comment } from "@/lib/api-client";
import { CommentField } from "./CommentField";

type Props = {
  videoId: string;
  // Given, this writes a Reply to that top-level Comment.
  parentId?: string;
  label: string;
  onPosted: (comment: Comment) => void;
  // Given, the form is a Reply form that can be closed, and it takes focus when it opens.
  onCancel?: () => void;
};

// Writes a Comment or a Reply. A refusal (including the rate limit, with how
// long to wait) stays inline under the field and the typed text is kept.
export function CommentComposer({ videoId, parentId, label, onPosted, onCancel }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (onCancel) field.current?.focus();
  }, [onCancel]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (text.trim() === "") return setError("Write something before posting.");
    setBusy(true);
    setError(undefined);
    const result = await postComment(videoId, { body: text, parentId });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setText("");
    toast.success(parentId ? "Reply posted" : "Comment posted");
    onPosted(result.comment);
  }

  return (
    <form className="grid gap-3" onSubmit={onSubmit} noValidate>
      <CommentField
        label={label}
        value={text}
        onChange={(value) => {
          setText(value);
          if (error) setError(undefined);
        }}
        error={error}
        rows={parentId ? 2 : 3}
        textareaRef={field}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy && <Spinner />}
          {parentId ? "Reply" : "Comment"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
