import "dotenv/config";
import { registerJobs } from "./jobs/index.ts";
import { createJobRunner } from "./lib/jobs.ts";

const jobs = createJobRunner();
await registerJobs(jobs);
await jobs.start();
console.log("Worker running");

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await jobs.stop();
    process.exit(0);
  });
}
