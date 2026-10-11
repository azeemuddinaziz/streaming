"use client";

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  FileVideoIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useReducer, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { toast } from "sonner";
import { Upload } from "tus-js-client";
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
import { Button } from "@/components/ui/button";
import { signInHref } from "@/lib/return-address";
import {
  classifyUploadError,
  formatBytes,
  formatRemaining,
  initialUploadState,
  milestone,
  percentOf,
  remainingSeconds,
  uploadReducer,
  type FailureKind,
  type FileInfo,
  type UploadState,
} from "@/lib/upload-state";

const TUS_URL = process.env.NEXT_PUBLIC_TUS_URL ?? "http://localhost:8080/files/";

const FAILURE_MESSAGE: Record<FailureKind, string> = {
  "signed-out": "You are signed out, so the upload stopped. Sign in again, then retry.",
  rejected: "The upload server did not accept this file. Retry, or choose a different file.",
  network: "The connection dropped and the upload stopped. Retry to carry on where it stopped.",
};

// One video at a time, straight to the tus server. Pause, resume and cancel act
// on the tus upload; the state machine is in `lib/upload-state.ts`.
export function UploadForm({ unfinishedNames = [] }: { unfinishedNames?: string[] }) {
  const [state, dispatch] = useReducer(uploadReducer, initialUploadState);
  const [dragging, setDragging] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const fileRef = useRef<File | null>(null);
  const uploadRef = useRef<Upload | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Set while the stored fingerprint is looked up, so a double click starts one upload.
  const starting = useRef(false);

  const active = state.phase === "uploading" || state.phase === "paused";

  // Leaving mid-upload stops it; ask first (it can be resumed by choosing the file again).
  useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);

  function choose(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (files.length > 1) {
      fileRef.current = null;
      dispatch({ type: "reject", problem: "Choose one video at a time." });
      return;
    }
    const file = files[0]!;
    fileRef.current = file;
    dispatch({ type: "choose", file: { name: file.name, size: file.size, type: file.type } });
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    choose(event.target.files);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (active) return;
    choose(event.dataTransfer.files);
  }

  async function begin() {
    const file = fileRef.current;
    if (!file || starting.current) return;
    starting.current = true;

    const upload = new Upload(file, {
      endpoint: TUS_URL,
      // Short pauses in the connection are retried without the person noticing.
      retryDelays: [0, 1000, 3000, 5000],
      metadata: { filename: file.name, filetype: file.type },
      removeFingerprintOnSuccess: true,
      // Sends the sign-in cookie, which the upload server hands to the API.
      onBeforeRequest(request) {
        const xhr = request.getUnderlyingObject();
        if (xhr instanceof XMLHttpRequest) xhr.withCredentials = true;
      },
      onProgress(sent, total) {
        if (uploadRef.current === upload) dispatch({ type: "progress", sent, total, now: Date.now() });
      },
      onSuccess() {
        if (uploadRef.current === upload) dispatch({ type: "success" });
      },
      onError(error) {
        if (uploadRef.current !== upload) return;
        const response = "originalResponse" in error ? error.originalResponse : null;
        dispatch({ type: "error", kind: classifyUploadError(response ? response.getStatus() : null) });
      },
    });
    uploadRef.current = upload;

    // The same file chosen again after an interruption picks up where it stopped.
    let resumed = false;
    try {
      const previous = await upload.findPreviousUploads();
      if (previous.length > 0) {
        upload.resumeFromPreviousUpload(previous[0]!);
        resumed = true;
      }
    } catch {
      // No stored fingerprint to use: start from the beginning.
    }
    starting.current = false;
    if (uploadRef.current !== upload) return;

    dispatch({ type: "start", resumed, now: Date.now() });
    upload.start();
  }

  function pause() {
    void uploadRef.current?.abort();
    dispatch({ type: "pause" });
  }

  function resume() {
    dispatch({ type: "resume", now: Date.now() });
    uploadRef.current?.start();
  }

  function cancel() {
    const upload = uploadRef.current;
    uploadRef.current = null;
    fileRef.current = null;
    // Asks the upload server to throw away what it received; the page does not wait for it.
    upload?.abort(true).catch(() => {});
    dispatch({ type: "cancel" });
    setConfirmCancel(false);
    toast("Upload cancelled");
  }

  function chooseAnother() {
    uploadRef.current = null;
    fileRef.current = null;
    dispatch({ type: "reset" });
  }

  const announcement = announce(state);

  return (
    <div>
      <p role="status" className="sr-only">
        {announcement}
      </p>

      {(state.phase === "idle" || state.phase === "ready") && (
        <div
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={onDrop}
          data-dragging={dragging || undefined}
          className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-input bg-card p-6 text-center data-[dragging]:border-primary data-[dragging]:bg-secondary"
        >
          <UploadCloudIcon aria-hidden="true" className="size-10 text-muted-foreground" />
          {state.phase === "idle" ? (
            <>
              <p className="font-semibold">{dragging ? "Drop the video to select it" : "Drag a video here"}</p>
              <p className="text-sm text-muted-foreground">or</p>
              <Button type="button" onClick={() => inputRef.current?.click()}>
                Choose a video
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept="video/*"
                onChange={onPick}
                className="sr-only"
                tabIndex={-1}
                aria-label="Video file"
              />
            </>
          ) : (
            <ReadyFile
              file={state.file}
              resumable={unfinishedNames.includes(state.file.name)}
              onStart={() => void begin()}
              onCancel={chooseAnother}
            />
          )}
        </div>
      )}

      {state.phase === "idle" && state.problem && (
        <p role="alert" className="mt-4 flex items-start gap-2 text-sm text-destructive">
          <AlertTriangleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {state.problem}
        </p>
      )}

      {(state.phase === "uploading" || state.phase === "paused" || state.phase === "failed") && (
        <div className="grid gap-4 rounded-lg border bg-card p-5">
          <FileLine file={state.file} />
          <ProgressBar sent={state.sent} total={state.total} failed={state.phase === "failed"} />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              {formatBytes(state.sent)} of {formatBytes(state.total)}
            </span>
            <span>{statusLine(state)}</span>
          </div>

          {state.phase === "failed" && (
            <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {FAILURE_MESSAGE[state.kind]}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {state.phase === "uploading" && (
              <Button type="button" variant="outline" onClick={pause}>
                <PauseIcon aria-hidden="true" />
                Pause
              </Button>
            )}
            {state.phase === "paused" && (
              <Button type="button" onClick={resume}>
                <PlayIcon aria-hidden="true" />
                Resume
              </Button>
            )}
            {state.phase === "failed" && (
              <>
                <Button type="button" onClick={() => void begin()}>
                  <RotateCcwIcon aria-hidden="true" />
                  Retry
                </Button>
                {state.kind === "signed-out" && (
                  <Button asChild variant="outline">
                    <Link href={signInHref("/upload")}>Sign in</Link>
                  </Button>
                )}
                <Button type="button" variant="ghost" onClick={chooseAnother}>
                  Choose a different file
                </Button>
              </>
            )}
            {active && (
              <Button type="button" variant="ghost" onClick={() => setConfirmCancel(true)}>
                <XIcon aria-hidden="true" />
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      {state.phase === "done" && (
        <div className="grid gap-4 rounded-lg border bg-card p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2Icon aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-(--color-success)" />
            <div className="grid gap-1">
              <p className="font-semibold">Upload complete</p>
              <p className="text-sm text-muted-foreground">
                Processing started, you can leave this page. “{state.file.name}” appears in your Studio, where
                you can add its details.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/studio">Go to Studio</Link>
            </Button>
            <Button type="button" variant="outline" onClick={chooseAnother}>
              Upload another video
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this upload?</AlertDialogTitle>
            <AlertDialogDescription>
              What has been sent so far is discarded, and you would start again from the beginning.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep uploading</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                cancel();
              }}
            >
              Cancel upload
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FileLine({ file }: { file: FileInfo }) {
  return (
    <div className="flex items-center gap-3">
      <FileVideoIcon aria-hidden="true" className="size-6 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="break-words font-medium">{file.name}</p>
        <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
      </div>
    </div>
  );
}

function ReadyFile({
  file,
  resumable,
  onStart,
  onCancel,
}: {
  file: FileInfo;
  resumable: boolean;
  onStart: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <FileLine file={file} />
      {resumable && (
        <p className="text-sm text-muted-foreground">
          This file has an unfinished upload. It carries on where it stopped.
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={onStart}>
          {resumable ? "Resume upload" : "Start upload"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Choose a different file
        </Button>
      </div>
    </>
  );
}

function ProgressBar({ sent, total, failed }: { sent: number; total: number; failed: boolean }) {
  const percent = percentOf(sent, total);
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-label="Upload progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent} percent`}
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary"
      >
        <div
          className={`h-full rounded-full transition-[width] ${failed ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="w-12 text-right font-mono text-sm tabular-nums">{percent}%</span>
    </div>
  );
}

type Active = Extract<UploadState, { phase: "uploading" | "paused" | "failed" }>;

function statusLine(state: Active): string {
  if (state.phase === "paused") return "Paused";
  if (state.phase === "failed") return "Stopped";
  const resuming = state.resumed && state.sent === state.startSent ? "Resuming… " : "";
  return resuming + formatRemaining(remainingSeconds(state, Date.now()));
}

// Spoken updates for screen readers: coarse, so they are not a flood.
function announce(state: UploadState): string {
  switch (state.phase) {
    case "ready":
      return `${state.file.name} selected, ${formatBytes(state.file.size)}.`;
    case "uploading":
      return `Uploading, ${milestone(percentOf(state.sent, state.total))} percent.`;
    case "paused":
      return "Upload paused.";
    case "failed":
      return FAILURE_MESSAGE[state.kind];
    case "done":
      return "Upload complete. Processing started, you can leave this page.";
    default:
      return "";
  }
}
