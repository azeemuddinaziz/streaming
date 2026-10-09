"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteVideo } from "@/lib/api-client";

export function DeleteVideoButton({ videoId, label }: { videoId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function onClick() {
    if (!window.confirm(`Delete "${label}"? It will be gone for everyone and this cannot be undone.`)) {
      return;
    }
    setBusy(true);
    setMessage(undefined);
    const result = await deleteVideo(videoId);
    setBusy(false);
    if (result.ok) router.refresh();
    else setMessage(result.message);
  }

  return (
    <>
      <button className="button button-secondary" type="button" onClick={onClick} disabled={busy}>
        {busy ? "Deleting…" : "Delete"}
      </button>
      {message && <span role="alert">{message}</span>}
    </>
  );
}
