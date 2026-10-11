// What the Studio shows of a Video's life while it is processed. Pure, so the
// rules (a null number is "Starting…", which changes are worth saying aloud,
// when to keep polling) are tested without a page.

import type { StudioVideo } from "@/lib/api-client";

export type PhaseStep = { key: "uploaded" | "processing" | "ready"; label: string; state: "done" | "current" | "next" };

// The three phases of a Video that is still processing. Its bytes are already
// uploaded (an upload in flight is the Upload page's own bar).
export function processingSteps(): PhaseStep[] {
  return [
    { key: "uploaded", label: "Uploaded", state: "done" },
    { key: "processing", label: "Processing", state: "current" },
    { key: "ready", label: "Ready", state: "next" },
  ];
}

export type ProgressView =
  | { determinate: true; percent: number; text: string }
  | { determinate: false; text: string };

// A known number is a determinate bar; null (or anything unusable) is "Starting…".
export function progressView(progress: number | null | undefined): ProgressView {
  if (typeof progress !== "number" || !Number.isFinite(progress)) {
    return { determinate: false, text: "Starting…" };
  }
  const percent = Math.min(100, Math.max(0, Math.round(progress)));
  return { determinate: true, percent, text: `${percent}%` };
}

export type Finished = { id: string; label: string; status: "READY" | "FAILED" };

// The Videos that were processing and are not any more: what deserves a toast
// and a spoken announcement. A progress tick is not one.
export function finishedSince(before: StudioVideo[], after: StudioVideo[]): Finished[] {
  const was = new Map(before.map((video) => [video.id, video.status]));
  return after.flatMap((video) =>
    was.get(video.id) === "PROCESSING" && video.status !== "PROCESSING"
      ? [{ id: video.id, label: video.label, status: video.status }]
      : [],
  );
}

// Polling is only needed while something listed is still processing.
export function hasProcessing(videos: StudioVideo[]) {
  return videos.some((video) => video.status === "PROCESSING");
}

// Rows are updated in place: each current row is replaced by the polled one
// with the same id, and a row the poll did not return is kept as it is.
export function updateInPlace(current: StudioVideo[], polled: StudioVideo[]): StudioVideo[] {
  const byId = new Map(polled.map((video) => [video.id, video]));
  return current.map((video) => byId.get(video.id) ?? video);
}
