"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { useUnsavedChangesGuard } from "@/components/useUnsavedChangesGuard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { updateVideoDetails } from "@/lib/api-client";
import {
  DESCRIPTION_MAX,
  TITLE_MAX,
  fieldForMessage,
  isDirty,
  visibilityRule,
  type Details,
  type DetailsField,
  type Visibility,
} from "@/lib/video-details";

const CHOICES: { value: Visibility; label: string; hint: string }[] = [
  { value: "PRIVATE", label: "Private", hint: "Only you" },
  { value: "UNLISTED", label: "Unlisted", hint: "Anyone with the link" },
  { value: "PUBLIC", label: "Public", hint: "Anyone" },
];

function Count({ id, length, max }: { id: string; length: number; max: number }) {
  return (
    <span id={id} className={length >= max ? "text-destructive" : "text-muted-foreground"}>
      {length.toLocaleString("en")} / {max.toLocaleString("en")}
    </span>
  );
}

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

// The title, description, Visibility and Comments setting of one Video. The
// rule that Unlisted and Public need a title and a description is shown as the
// person types; the API's own refusals land on their fields. Leaving with
// unsaved changes asks first.
export function EditVideoForm({ videoId, initial }: { videoId: string; initial: Details }) {
  const router = useRouter();
  const ids = useId();
  const [saved, setSaved] = useState<Details>(initial);
  const [values, setValues] = useState<Details>(initial);
  const [errors, setErrors] = useState<Partial<Record<DetailsField, string>>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  const dirty = isDirty(saved, values);
  const { dialog } = useUnsavedChangesGuard(dirty);
  const rule = visibilityRule(values);
  const choice = rule[values.visibility];
  const blocked = !choice.allowed;
  const working = busy || refreshing;

  function change(patch: Partial<Details>) {
    setValues((current) => ({ ...current, ...patch }));
    setErrors({});
    setFormError(undefined);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || blocked || working) return;
    setBusy(true);
    setErrors({});
    setFormError(undefined);
    const result = await updateVideoDetails(videoId, values);
    setBusy(false);
    if (!result.ok) {
      const field = fieldForMessage(result.message);
      if (field) setErrors({ [field]: result.message });
      else setFormError(result.message);
      return;
    }
    setSaved(values);
    toast.success("Details saved");
    startRefresh(() => router.refresh());
  }

  const titleId = `${ids}-title`;
  const descriptionId = `${ids}-description`;
  const visibilityId = `${ids}-visibility`;
  const visibilityProblem = errors.visibility ?? (blocked ? choice.reason : undefined);

  return (
    <>
      <form className="grid gap-6" onSubmit={onSubmit} noValidate>
        {formError && (
          <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">
            {formError}
          </p>
        )}

        <div className="grid gap-2">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <Label htmlFor={titleId}>Title</Label>
            <Count id={`${titleId}-count`} length={values.title.length} max={TITLE_MAX} />
          </div>
          <Input
            id={titleId}
            name="title"
            maxLength={TITLE_MAX}
            value={values.title}
            onChange={(event) => change({ title: event.target.value })}
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={`${titleId}-count${errors.title ? ` ${titleId}-error` : ""}`}
          />
          <FieldError id={`${titleId}-error`} message={errors.title} />
        </div>

        <div className="grid gap-2">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <Label htmlFor={descriptionId}>Description</Label>
            <Count id={`${descriptionId}-count`} length={values.description.length} max={DESCRIPTION_MAX} />
          </div>
          <Textarea
            id={descriptionId}
            name="description"
            rows={6}
            maxLength={DESCRIPTION_MAX}
            value={values.description}
            onChange={(event) => change({ description: event.target.value })}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={`${descriptionId}-count${errors.description ? ` ${descriptionId}-error` : ""}`}
          />
          <FieldError id={`${descriptionId}-error`} message={errors.description} />
        </div>

        <fieldset className="grid gap-2" aria-describedby={visibilityProblem ? `${visibilityId}-problem` : undefined}>
          <legend className="mb-1 text-sm font-medium">Visibility</legend>
          {CHOICES.map(({ value, label, hint }) => {
            const option = rule[value];
            const inputId = `${visibilityId}-${value}`;
            return (
              <label
                key={value}
                htmlFor={inputId}
                className="flex items-start gap-3 rounded-md border p-3 has-[:checked]:border-primary has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring has-[:disabled]:opacity-60"
              >
                <input
                  id={inputId}
                  type="radio"
                  name="visibility"
                  value={value}
                  checked={values.visibility === value}
                  disabled={!option.allowed && values.visibility !== value}
                  onChange={() => change({ visibility: value })}
                  className="mt-1 accent-primary"
                />
                <span className="grid gap-0.5 text-sm">
                  <span className="font-medium">{label}</span>
                  <span className="text-muted-foreground">
                    {hint}
                    {!option.allowed && ` · ${option.reason}`}
                  </span>
                </span>
              </label>
            );
          })}
          {visibilityProblem && (
            <p
              id={`${visibilityId}-problem`}
              role={errors.visibility ? "alert" : undefined}
              className="text-sm text-destructive"
            >
              {visibilityProblem}
            </p>
          )}
        </fieldset>

        <div className="grid gap-1">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`${ids}-comments`}
              checked={values.commentsEnabled}
              onCheckedChange={(checked) => change({ commentsEnabled: checked === true })}
              aria-describedby={`${ids}-comments-hint${errors.commentsEnabled ? ` ${ids}-comments-error` : ""}`}
            />
            <Label htmlFor={`${ids}-comments`}>Allow comments</Label>
          </div>
          <p id={`${ids}-comments-hint`} className="text-sm text-muted-foreground">
            Turned off, viewers see no comments and nobody can write or edit one. Nothing is deleted; turn it back on
            to restore them.
          </p>
          <FieldError id={`${ids}-comments-error`} message={errors.commentsEnabled} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!dirty || blocked || working}>
            {working && <Spinner />}
            {working ? "Saving…" : "Save changes"}
          </Button>
          <span role="status" className="text-sm text-muted-foreground">
            {dirty ? "Unsaved changes" : ""}
          </span>
        </div>
      </form>
      {dialog}
    </>
  );
}
