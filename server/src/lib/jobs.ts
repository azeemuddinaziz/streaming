import { PgBoss } from "pg-boss";
import { runJob, workerError, workerLog } from "./worker-log.ts";

export type JobState = "created" | "retry" | "active" | "completed" | "cancelled" | "failed";

type JobAttempt = {
  // True when the job will not be run again if this attempt fails.
  final: boolean;
};

type JobHandler = (data: any, attempt: JobAttempt) => Promise<void>;

type JobOptions = {
  // A cron expression (UTC). The worker queues the job whenever it comes due.
  schedule?: string;
};

type JobRunnerOptions = {
  // How many times a failing job is run again before it is recorded as failed.
  retryLimit?: number;
  // Seconds before the first retry. Later retries wait longer.
  retryDelaySeconds?: number;
};

// Queues work in Postgres (through pg-boss) so it can run outside the request
// cycle. The API only enqueues; a separate worker process starts the runner
// with `work: true` and runs the handlers registered on it. Retry settings are
// stored with the queue when it is first created, so every process should use
// the same ones.
export function createJobRunner({ retryLimit = 3, retryDelaySeconds = 30 }: JobRunnerOptions = {}) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");

  const boss = new PgBoss(connectionString);
  const handlers = new Map<string, { handler: JobHandler; schedule?: string }>();
  const queues = new Set<string>();

  // Queues must exist before a job is sent or worked. Creating one that exists
  // is a no-op, so a process that only enqueues needs no registered handler.
  async function ensureQueue(name: string) {
    if (queues.has(name)) return;
    await boss.createQueue(name, { retryLimit, retryDelay: retryDelaySeconds, retryBackoff: true });
    queues.add(name);
  }

  // A process that works jobs is the worker and logs as one; one that only
  // enqueues (the API) keeps a plain error line.
  let working = false;
  boss.on("error", (error) => {
    if (working) workerError("worker.error", error);
    else console.error("Job runner error:", error);
  });

  return {
    // Declares a job name and the function that runs it. Call before start().
    register(name: string, handler: JobHandler, { schedule }: JobOptions = {}) {
      handlers.set(name, { handler, schedule });
    },

    // Connects to the database. Workers start processing registered jobs;
    // pass { work: false } to only enqueue and read status (the API does this).
    async start({ work = true }: { work?: boolean } = {}) {
      working = work;
      await boss.start();
      for (const [name, { schedule }] of handlers) {
        await ensureQueue(name);
        // Stored in the database, so starting the worker again updates it.
        if (work && schedule) await boss.schedule(name, schedule);
      }
      if (!work) return;

      // Written before any handler is attached, so a job already waiting
      // cannot log its first line ahead of it.
      workerLog("worker.started", {
        jobs: [...handlers].map(([name, { schedule }]) => ({ name, schedule: schedule ?? null })),
      });
      for (const [name, { handler }] of handlers) {
        await boss.work<object, void, { includeMetadata: true }>(name, { includeMetadata: true }, async ([job]) => {
          const final = job.retryCount >= job.retryLimit;
          // Each attempt is logged from start to end (see worker-log.ts).
          await runJob({ job: name, jobId: job.id, attempt: job.retryCount + 1, final }, () =>
            handler(job.data, { final }),
          );
        });
      }
    },

    async enqueue(name: string, data: object = {}) {
      await ensureQueue(name);
      const id = await boss.send(name, data);
      if (!id) throw new Error(`Could not queue job "${name}".`);
      return id;
    },

    async status(name: string, id: string): Promise<JobState | null> {
      const job = await boss.getJobById(name, id);
      return job?.state ?? null;
    },

    stop: () => boss.stop({ graceful: true, timeout: 10_000 }),
  };
}

export type JobRunner = ReturnType<typeof createJobRunner>;
