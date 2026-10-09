"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getApiBaseUrl, replaceThumbnail } from "@/lib/api-client";

export function ThumbnailPicker({
  videoId,
  label,
  thumbnailPath,
}: {
  videoId: string;
  label: string;
  thumbnailPath: string | null;
}) {
  const router = useRouter();
  const [path, setPath] = useState(thumbnailPath);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage(undefined);
    const result = await replaceThumbnail(videoId, file);
    setBusy(false);
    input.value = "";
    if (result.ok) {
      setPath(result.thumbnailPath);
      setMessage("Thumbnail updated.");
      router.refresh();
    } else {
      setMessage(result.message);
    }
  }

  return (
    <div className="thumbnail-picker">
      {path && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="thumbnail"
          src={`${process.env.NEXT_PUBLIC_API_URL ?? getApiBaseUrl()}${path}`}
          alt={`Thumbnail of ${label}`}
        />
      )}
      <label className="button button-secondary">
        {busy ? "Uploading…" : "Change thumbnail"}
        <input type="file" accept="image/*" onChange={onChange} disabled={busy} hidden />
      </label>
      <span className="hint" role="status">{message}</span>
    </div>
  );
}
