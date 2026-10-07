import type { JobRunner } from "../lib/jobs.ts";
import { removeUploadBytes } from "../lib/tusd.ts";
import { UploadService } from "../services/uploads.service.ts";

// Every background job the worker runs is registered here. Video processing
// adds its own in a later ticket.
export async function registerJobs(jobs: JobRunner) {
  // Removes Uploads left unfinished for over 24 hours, with their bytes.
  jobs.register(
    "discard-stale-uploads",
    () => UploadService.discardStale(removeUploadBytes).then(() => undefined),
    { schedule: "0 * * * *" },
  );
}
