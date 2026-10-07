import "dotenv/config";
import { registerJobs } from "./jobs/index.ts";
import { createJobRunner } from "./lib/jobs.ts";

const jobs = createJobRunner();
await registerJobs(jobs);
await jobs.start();
console.log("Worker running");

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    if (stopping) return;
    stopping = true;
    try {
      await jobs.stop();
      process.exit(0);
    } catch (error) {
      console.error("Worker did not stop cleanly:", error);
      process.exit(1);
    }
  });
}
