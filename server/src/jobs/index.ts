import type { JobRunner } from "../lib/jobs.ts";

// Every background job the worker runs is registered here. Video processing and
// Upload cleanup add theirs in later tickets.
export async function registerJobs(_jobs: JobRunner) {}
