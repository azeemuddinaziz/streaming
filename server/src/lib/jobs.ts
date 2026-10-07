import { PgBoss } from "pg-boss";

export type JobState = "created" | "retry" | "active" | "completed" | "cancelled" | "failed";

type JobHandler = (data: any) => Promise<void>;

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
  const handlers = new Map<string, JobHandler>();
  const queues = new Set<string>();

  // Queues must exist before a job is sent or worked. Creating one that exists
  // is a no-op, so a process that only enqueues needs no registered handler.
  async function ensureQueue(name: string) {
    if (queues.has(name)) return;
    await boss.createQueue(name, { retryLimit, retryDelay: retryDelaySeconds, retryBackoff: true });
    queues.add(name);
  }

  boss.on("error", (error) => console.error("Job runner error:", error));

  return {
    // Declares a job name and the function that runs it. Call before start().
    register(name: string, handler: JobHandler) {
      handlers.set(name, handler);
    },

    // Connects to the database. Workers start processing registered jobs;
    // pass { work: false } to only enqueue and read status (the API does this).
    async start({ work = true }: { work?: boolean } = {}) {
      await boss.start();
      for (const [name, handler] of handlers) {
        await ensureQueue(name);
        if (work) {
          await boss.work<object>(name, async ([job]) => {
            await handler(job.data);
          });
        }
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
