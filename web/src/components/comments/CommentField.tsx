import { useId } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COMMENT_MAX } from "@/lib/api-client";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  // A rule the person broke or an answer from the API, shown under the field.
  error?: string;
  rows?: number;
  autoFocus?: boolean;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
};

// The labelled text box of a Comment, Reply or edit, with its running length
// (the limit is the API's) and its inline error tied to the field.
export function CommentField({ label, value, onChange, error, rows = 3, autoFocus, textareaRef }: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        ref={textareaRef}
        rows={rows}
        maxLength={COMMENT_MAX}
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
      />
      <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
        {error && (
          <p id={errorId} role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <p id={hintId} className="ml-auto font-mono text-muted-foreground">
          {value.length} / {COMMENT_MAX}
        </p>
      </div>
    </div>
  );
}
