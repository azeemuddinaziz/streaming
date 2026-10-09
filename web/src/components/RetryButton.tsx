"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { retryVideo } from "@/lib/api-client";

export function RetryButton({ videoId }: { videoId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function onClick() {
    setBusy(true);
    setMessage(undefined);
    const result = await retryVideo(videoId);
    setBusy(false);
    if (result.ok) router.refresh();
    else setMessage(result.message);
  }

  return (
    <>
      <button
        className="button button-secondary"
        type="button"
        onClick={onClick}
        disabled={busy}
      >
        {busy ? "Retrying…" : "Retry"}
      </button>
      {message && <span role="alert">{message}</span>}
    </>
  );
}
