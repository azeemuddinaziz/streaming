import { afterEach, describe, expect, it } from "vitest";
import { createJobRunner, type JobRunner } from "./jobs.ts";

async function waitFor<T>(read: () => Promise<T>, done: (value: T) => boolean) {
  const deadline = Date.now() + 25_000;
  for (;;) {
    const value = await read();
    if (done(value)) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting; last value: ${String(value)}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

describe("job runner", () => {
  let runner: JobRunner | undefined;

  afterEach(async () => {
    await runner?.stop();
    runner = undefined;
  });

  async function start(options: Parameters<typeof createJobRunner>[0] = {}) {
    runner = createJobRunner({ retryLimit: 2, retryDelaySeconds: 1, ...options });
    return runner;
  }

  it("runs a queued job with its data and marks it completed", async () => {
    const jobs = await start();
    const seen: unknown[] = [];
    await jobs.register("test-ok", async (data) => {
      seen.push(data);
    });
    await jobs.start();

    const id = await jobs.enqueue("test-ok", { videoId: "abc" });
    const state = await waitFor(() => jobs.status("test-ok", id), (s) => s === "completed");

    expect(state).toBe("completed");
    expect(seen).toEqual([{ videoId: "abc" }]);
  });

  it("retries a failing job a bounded number of times, then records it as failed", async () => {
    const jobs = await start({ retryLimit: 2 });
    let attempts = 0;
    await jobs.register("test-fail", async () => {
      attempts += 1;
      throw new Error("boom");
    });
    await jobs.start();

    const id = await jobs.enqueue("test-fail", {});
    const state = await waitFor(() => jobs.status("test-fail", id), (s) => s === "failed");

    expect(state).toBe("failed");
    // The first attempt plus two retries.
    expect(attempts).toBe(3);
  }, 30_000);

  it("lets a process with no handlers enqueue, and holds the job until a worker starts", async () => {
    const producer = await start();
    await producer.start({ work: false });
    const id = await producer.enqueue("test-later", {});

    expect(await producer.status("test-later", id)).toBe("created");
  });
});
