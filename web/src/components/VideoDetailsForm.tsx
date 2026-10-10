"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { updateVideoDetails, type StudioVideo } from "@/lib/api-client";

export function VideoDetailsForm({ video }: { video: StudioVideo }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setMessage(undefined);
    const result = await updateVideoDetails(video.id, {
      title: String(data.get("title")),
      description: String(data.get("description")),
      visibility: String(data.get("visibility")) as StudioVideo["visibility"],
      commentsEnabled: data.get("commentsEnabled") === "on",
    });
    setBusy(false);
    if (result.ok) {
      setMessage("Saved.");
      router.refresh();
    } else setMessage(result.message);
  }

  return (
    <details className="video-details">
      <summary>Edit details</summary>
      <form className="form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor={`title-${video.id}`}>Title</label>
          <input
            id={`title-${video.id}`}
            name="title"
            maxLength={100}
            defaultValue={video.title ?? ""}
          />
        </div>
        <div className="field">
          <label htmlFor={`description-${video.id}`}>Description</label>
          <textarea
            id={`description-${video.id}`}
            name="description"
            rows={3}
            maxLength={5000}
            defaultValue={video.description ?? ""}
          />
        </div>
        <div className="field">
          <label htmlFor={`visibility-${video.id}`}>Visibility</label>
          <select
            id={`visibility-${video.id}`}
            name="visibility"
            defaultValue={video.visibility}
          >
            <option value="PRIVATE">Private</option>
            <option value="UNLISTED">Unlisted</option>
            <option value="PUBLIC">Public</option>
          </select>
          <p className="hint">
            Unlisted and public need both a title and a description.
          </p>
        </div>
        <div className="field field-check">
          <label htmlFor={`comments-${video.id}`}>
            <input
              id={`comments-${video.id}`}
              name="commentsEnabled"
              type="checkbox"
              defaultChecked={video.commentsEnabled}
            />{" "}
            Allow comments
          </label>
          <p className="hint">
            Turned off, viewers see no comments and nobody can write or edit one. Nothing is deleted; turn it
            back on to restore them.
          </p>
        </div>
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}
