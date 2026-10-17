import "dotenv/config";
import { registerJobs } from "./jobs/index.ts";
import { createJobRunner } from "./lib/jobs.ts";
import { workerError, workerLog } from "./lib/worker-log.ts";

const jobs = createJobRunner();
await registerJobs(jobs);
await jobs.start();
workerLog("worker.started", { jobs: jobs.registered() });

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
