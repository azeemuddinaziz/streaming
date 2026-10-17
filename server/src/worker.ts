import "dotenv/config";
import { registerJobs } from "./jobs/index.ts";
import { createJobRunner } from "./lib/jobs.ts";
import { workerError, workerLog } from "./lib/worker-log.ts";

const jobs = createJobRunner();
await registerJobs(jobs);
// The job runner writes the worker.started line once it is connected.
await jobs.start();

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    if (stopping) return;
    stopping = true;
    workerLog("worker.stopping", { signal });
    try {
      await jobs.stop();
      workerLog("worker.stopped");
      process.exit(0);
    } catch (error) {
      workerError("worker.stop_failed", error);
      process.exit(1);
    }
  });
}
