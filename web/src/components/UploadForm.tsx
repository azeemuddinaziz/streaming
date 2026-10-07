"use client";

import { useRef, useState, type FormEvent } from "react";
import { Upload } from "tus-js-client";

const TUS_URL = process.env.NEXT_PUBLIC_TUS_URL ?? "http://localhost:8080/files/";

type Status =
  | { state: "idle" }
  | { state: "uploading"; percent: number; resumed: boolean }
  | { state: "done" }
  | { state: "failed"; message: string };

export function UploadForm() {
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const uploadRef = useRef<Upload>(null);
  const busy = status.state === "uploading";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get("file");
    if (!(file instanceof File) || file.size === 0) return;

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
        setStatus((current) => ({
          state: "uploading",
          percent: Math.floor((sent / total) * 100),
          resumed: current.state === "uploading" && current.resumed,
        }));
      },
      onSuccess() {
        setStatus({ state: "done" });
      },
      onError(error) {
        const refused = "originalResponse" in error && error.originalResponse;
        setStatus({
          state: "failed",
          message:
            refused && refused.getStatus() === 401
              ? "Sign in again to upload."
              : "The upload was interrupted. Choose the same file again to carry on where it stopped.",
        });
      },
    });
    uploadRef.current = upload;

    // The same file chosen again after an interruption picks up where it stopped.
    const previous = await upload.findPreviousUploads();
    const resumed = previous.length > 0;
    if (resumed) upload.resumeFromPreviousUpload(previous[0]!);

    setStatus({ state: "uploading", percent: 0, resumed });
    upload.start();
  }

  return (
    <form className="form" onSubmit={onSubmit} aria-busy={busy}>
      {status.state === "failed" && (
        <p className="form-error" role="alert">
          {status.message}
        </p>
      )}

      <div className="field">
        <label htmlFor="file">Video file</label>
        <input id="file" name="file" type="file" accept="video/*" required disabled={busy} />
      </div>

      {status.state === "uploading" && (
        <div className="field">
          <progress max={100} value={status.percent} aria-label="Upload progress" />
          <p className="hint" role="status">
            {status.resumed ? "Resuming. " : ""}
            {status.percent}% uploaded
          </p>
        </div>
      )}

      {status.state === "done" && (
        <p className="hint" role="status">
          Upload complete.
        </p>
      )}

      <button className="button" type="submit" disabled={busy}>
        {busy ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}
