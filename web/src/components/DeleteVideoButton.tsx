"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { deleteVideo } from "@/lib/api-client";

// Delete behind an AlertDialog. A failure stays in the dialog, where the person
// is looking; a success closes it, raises a toast and refreshes the list.
export function DeleteVideoButton({ videoId, label }: { videoId: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [message, setMessage] = useState<string>();
  const working = busy || refreshing;

  async function remove() {
    setBusy(true);
    setMessage(undefined);
    const result = await deleteVideo(videoId);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setOpen(false);
    toast.success(`Deleted "${label}"`);
    startRefresh(() => router.refresh());
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (working) return;
        setOpen(next);
        if (!next) setMessage(undefined);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" aria-label={`Delete ${label}`}>
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this video?</AlertDialogTitle>
          <AlertDialogDescription>
            “{label}” will be gone for everyone. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {message && (
          <p role="alert" className="text-sm text-destructive">
            {message}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={working}
            onClick={(event) => {
              event.preventDefault();
              void remove();
            }}
          >
            {working && <Spinner />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
