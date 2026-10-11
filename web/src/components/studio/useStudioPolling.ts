"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { fetchStudioPage, type StudioVideo } from "@/lib/api-client";
import { finishedSince, hasProcessing, updateInPlace } from "@/lib/processing-phase";

export const POLL_INTERVAL_MS = 4000;

type Query = { page: number; status: StudioVideo["status"] | undefined };

// The page's Videos, kept current while any is processing. It asks the API for
// the same page every few seconds, only while a listed Video is PROCESSING and
// the tab is visible, and stops when nothing is. Rows change in place; a Video
// that finishes raises a toast, is returned in `announcement` for a polite
// live region, and refreshes the server page so counts and filters are right.
export function useStudioPolling(initial: StudioVideo[], query: Query, intervalMs = POLL_INTERVAL_MS) {
  const router = useRouter();
  const [videos, setVideos] = useState(initial);
  const [source, setSource] = useState(initial);
  const [announcement, setAnnouncement] = useState("");
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

      if (result.ok) {
        const before = current.current;
        const next = updateInPlace(before, result.videos);
        const finished = finishedSince(before, next);
        current.current = next;
        setVideos((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));

        if (finished.length > 0) {
          for (const video of finished) {
            if (video.status === "READY") toast.success(`${video.label} is ready`);
            else toast.error(`${video.label} could not be processed`);
          }
          setAnnouncement(
            finished
              .map((video) => `${video.label} ${video.status === "READY" ? "is ready" : "failed to process"}.`)
              .join(" "),
          );
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
