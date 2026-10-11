"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { fetchStudioPage, type StudioVideo } from "@/lib/api-client";
import {
  departedSince,
  finishedMessage,
  finishedSince,
  hasProcessing,
  updateInPlace,
} from "@/lib/processing-phase";

export const POLL_INTERVAL_MS = 4000;

type Query = { page: number; status: StudioVideo["status"] | undefined };

// The page's Videos, kept current while any is processing. It asks the API for
// the same page every few seconds, only while a listed Video is PROCESSING and
// the tab is visible, and stops when nothing is. Rows change in place; a Video
// that finishes raises a toast, is returned in `announcement` for a polite
// live region, and refreshes the server page so counts and filters are right.
// A Video the poll no longer returns (it left a "Processing" filter) is
// dropped from the rows and reloaded from the server the same way.
export function useStudioPolling(initial: StudioVideo[], query: Query, intervalMs = POLL_INTERVAL_MS) {
  const router = useRouter();
  const [videos, setVideos] = useState(initial);
  const [source, setSource] = useState(initial);
  const [announcement, setAnnouncement] = useState("");
  const announced = useRef(0);
  const current = useRef(videos);

  // A fresh server render (after a refresh) replaces what was polled.
  if (source !== initial) {
    setSource(initial);
    setVideos(initial);
  }
  useEffect(() => {
    current.current = videos;
  }, [videos]);

  const processing = hasProcessing(videos);
  const { page, status } = query;

  useEffect(() => {
    if (!processing) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let inFlight = false;

    const schedule = () => {
      if (!stopped && !document.hidden) timer = setTimeout(poll, intervalMs);
    };

    async function poll() {
      if (inFlight) return;
      inFlight = true;
      const result = await fetchStudioPage({ page, status });
      inFlight = false;
      if (stopped) return;

      if (!result.ok && result.reason === "signed-out") {
        // The server page redirects to sign-in; nothing more to poll.
        router.refresh();
        return;
      }

      if (result.ok) {
        const before = current.current;
        const departed = departedSince(before, result.videos);
        const gone = new Set(departed.map((video) => video.id));
        const next = updateInPlace(before, result.videos).filter((video) => !gone.has(video.id));
        const finished = finishedSince(before, next);
        current.current = next;
        setVideos((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));

        if (finished.length + departed.length > 0) {
          for (const video of finished) {
            if (video.status === "READY") toast.success(finishedMessage(video));
            else toast.error(finishedMessage(video));
          }
          for (const video of departed) toast(finishedMessage({ label: video.label, status: "GONE" }));
          const spoken = [
            ...finished.map(finishedMessage),
            ...departed.map((video) => finishedMessage({ label: video.label, status: "GONE" })),
          ];
          // A trailing non-breaking space on alternate announcements makes a
          // repeated sentence count as a change, so it is read again.
          announced.current += 1;
          setAnnouncement(`${spoken.join(". ")}.${announced.current % 2 ? "" : "\u00a0"}`);
          router.refresh();
        }
      }
      schedule();
    }

    // Hidden tabs do not poll; coming back checks at once and resumes.
    const onVisibility = () => {
      clearTimeout(timer);
      if (!document.hidden) void poll();
    };

    document.addEventListener("visibilitychange", onVisibility);
    schedule();
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [processing, page, status, intervalMs, router]);

  return { videos, announcement };
}
