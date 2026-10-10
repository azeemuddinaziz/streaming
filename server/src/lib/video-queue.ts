import { createJobRunner, type JobRunner } from "./jobs.ts";

export const PROCESS_VIDEO_JOB = "process-video";

let runner: Promise<JobRunner> | undefined;

// The API only queues work; the worker process runs it. The connection to the
// queue is opened on first use and kept.
export async function queueVideoProcessing(videoId: string) {
  runner ??= (async () => {
    const jobs = createJobRunner();
    await jobs.start({ work: false });
    return jobs;
  })();

  try {
    await (await runner).enqueue(PROCESS_VIDEO_JOB, { videoId });
  } catch (error) {
    runner = undefined;
    throw error;
  }
}
