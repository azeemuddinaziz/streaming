"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { retryVideo } from "@/lib/api-client";

// Retry stays pending until the refreshed list arrives, so the row visibly
// changes to Processing while the button is still busy. A failure is inline.
export function RetryButton({ videoId, label }: { videoId: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [message, setMessage] = useState<string>();
  const working = busy || refreshing;

  async function onClick() {
    setBusy(true);
    setMessage(undefined);
    const result = await retryVideo(videoId);
    setBusy(false);
    if (result.ok) {
      toast.success("Processing again");
      startRefresh(() => router.refresh());
    } else {
      setMessage(result.message);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={working}
        aria-label={label && !working ? `Retry ${label}` : undefined}
      >
        {working && <Spinner />}
        {working ? "Retrying…" : "Retry"}
      </Button>
      {message && (
        <span role="alert" className="text-sm text-destructive">
          {message}
        </span>
      )}
    </>
  );
}
