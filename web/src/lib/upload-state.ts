// The logic of the upload page, kept apart from the component: which file is
// acceptable, which state the upload is in and how it moves, how long is left.
// The component owns the tus upload itself and feeds its events in here.

export type FileInfo = { name: string; size: number; type: string };

const VIDEO_EXTENSIONS = ["mp4", "m4v", "mov", "mkv", "webm", "avi", "mpg", "mpeg", "ogv", "3gp", "wmv", "flv"];

// A reason the file cannot be uploaded, or null. Checked before anything is sent.
export function validateVideoFile(file: FileInfo): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const looksLikeVideo = file.type ? file.type.startsWith("video/") : VIDEO_EXTENSIONS.includes(extension);
  if (!looksLikeVideo) {
    return `“${file.name}” is not a video. Choose a video file such as MP4, MOV or WebM.`;
  }
  if (file.size === 0) return `“${file.name}” is empty. Choose another file.`;
  return null;
}

export type FailureKind = "signed-out" | "rejected" | "network";

// `status` is the HTTP status the upload server answered with, if it answered.
export function classifyUploadError(status: number | null): FailureKind {
  if (status === 401) return "signed-out";
  if (status !== null && status >= 400 && status < 500) return "rejected";
  return "network";
}

type Progress = { sent: number; total: number; resumed: boolean; startedAt: number; startSent: number };

export type UploadState =
  | { phase: "idle"; problem?: string }
  | { phase: "ready"; file: FileInfo }
  | ({ phase: "uploading"; file: FileInfo } & Progress)
  | ({ phase: "paused"; file: FileInfo } & Progress)
  | ({ phase: "failed"; file: FileInfo; kind: FailureKind } & Progress)
  | { phase: "done"; file: FileInfo };

export type UploadEvent =
  | { type: "choose"; file: FileInfo }
  | { type: "reject"; problem: string }
  | { type: "start"; resumed: boolean; now: number }
  | { type: "progress"; sent: number; total: number; now: number }
  | { type: "pause" }
  | { type: "resume"; now: number }
  | { type: "success" }
  | { type: "error"; kind: FailureKind }
  | { type: "cancel" }
  | { type: "reset" };

export const initialUploadState: UploadState = { phase: "idle" };

export function uploadReducer(state: UploadState, event: UploadEvent): UploadState {
  switch (event.type) {
    case "choose": {
      if (state.phase === "uploading" || state.phase === "paused") return state;
      const problem = validateVideoFile(event.file);
      return problem ? { phase: "idle", problem } : { phase: "ready", file: event.file };
    }
    case "reject":
      return state.phase === "uploading" || state.phase === "paused"
        ? state
        : { phase: "idle", problem: event.problem };
    case "start": {
      if (state.phase === "ready") {
        const { file } = state;
        return {
          phase: "uploading",
          file,
          sent: 0,
          total: file.size,
          resumed: event.resumed,
          startedAt: event.now,
          startSent: 0,
        };
      }
      if (state.phase === "failed") {
        const { phase: _phase, kind: _kind, ...rest } = state;
        return { ...rest, phase: "uploading", resumed: event.resumed, startedAt: event.now, startSent: state.sent };
      }
      return state;
    }
    case "progress":
      // Late progress after a pause or cancel is dropped.
      if (state.phase !== "uploading") return state;
      return { ...state, sent: event.sent, total: event.total };
    case "pause":
      return state.phase === "uploading" ? { ...state, phase: "paused" } : state;
    case "resume":
      return state.phase === "paused"
        ? { ...state, phase: "uploading", startedAt: event.now, startSent: state.sent }
        : state;
    case "success":
      return state.phase === "uploading" ? { phase: "done", file: state.file } : state;
    case "error":
      return state.phase === "uploading" ? { ...state, phase: "failed", kind: event.kind } : state;
    case "cancel":
    case "reset":
      return initialUploadState;
  }
}

// Seconds left at the speed of the current run, or null until there is enough to
// measure (two seconds of progress), so the first guess is not wild.
export function remainingSeconds(
  progress: Pick<Progress, "sent" | "total" | "startedAt" | "startSent">,
  now: number,
): number | null {
  const elapsed = (now - progress.startedAt) / 1000;
  const moved = progress.sent - progress.startSent;
  if (elapsed < 2 || moved <= 0) return null;
  return Math.ceil((progress.total - progress.sent) / (moved / elapsed));
}

export function formatRemaining(seconds: number | null): string {
  if (seconds === null) return "Estimating time left…";
  if (seconds < 60) {
    const whole = Math.max(1, Math.round(seconds));
    return `About ${whole} ${whole === 1 ? "second" : "seconds"} left`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `About ${minutes} ${minutes === 1 ? "minute" : "minutes"} left`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourText = `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return rest === 0
    ? `About ${hourText} left`
    : `About ${hourText} ${rest} ${rest === 1 ? "minute" : "minutes"} left`;
}

export function formatBytes(bytes: number): string {
  const units = ["B", "kB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const text = unit === 0 || value >= 100 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, "");
  return `${text} ${units[unit]}`;
}

export function percentOf(sent: number, total: number): number {
  return total > 0 ? Math.min(100, Math.floor((sent / total) * 100)) : 0;
}

// Progress is announced in quarters, not on every tick.
export function milestone(percent: number): number {
  return Math.floor(percent / 25) * 25;
}
