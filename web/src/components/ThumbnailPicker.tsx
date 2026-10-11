"use client";

import { FilmIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getApiBaseUrl, replaceThumbnail } from "@/lib/api-client";

// The Thumbnail at 16:9 and a "Change thumbnail" button. The new image shows
// as soon as the API has it; a refusal stays inline under the image.
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
  const input = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState(thumbnailPath);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage(undefined);
    const result = await replaceThumbnail(videoId, file);
    setBusy(false);
    if (input.current) input.current.value = "";
    if (result.ok) {
      setPath(result.thumbnailPath);
      toast.success("Thumbnail updated");
      router.refresh();
    } else {
      setMessage(result.message);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="relative aspect-video overflow-hidden rounded-md border bg-border">
        {path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="size-full object-cover"
            src={`${getApiBaseUrl()}${path}`}
            alt={`Thumbnail of ${label}`}
          />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <FilmIcon aria-hidden="true" className="size-8" />
          </div>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-label="Thumbnail image file"
        onChange={onChange}
      />
      <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
        {busy && <Spinner />}
        {busy ? "Uploading…" : "Change thumbnail"}
      </Button>
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
