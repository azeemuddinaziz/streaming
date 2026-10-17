import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ExpectedJobError,
  enrichJob,
  formatPretty,
  jobLog,
  redactInJob,
  runJob,
  setWorkerEmit,
  workerError,
  workerLog,
  type WorkerLine,
} from "./worker-log.ts";

let lines: WorkerLine[];

beforeEach(() => {
  lines = [];
  setWorkerEmit((line) => lines.push(line));
});

afterEach(() => setWorkerEmit(null));

const attempt = { job: "process-video", jobId: "job-1", attempt: 1, final: false };

describe("worker lines", () => {
  it("marks every line as the worker's, with its event name and time", () => {
    workerLog("worker.started", { jobs: [{ name: "a", schedule: null }] });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      service: "worker",
      event: "worker.started",
      jobs: [{ name: "a", schedule: null }],
    });
    expect(typeof lines[0]!.time).toBe("string");
  });

  it("never throws when the emitter does", () => {
    setWorkerEmit(() => {
      throw new Error("disk full");
    });

    expect(() => workerLog("worker.started")).not.toThrow();
    expect(() => jobLog("video.phase")).not.toThrow();
  });

  it("writes job lines only inside a job", () => {
    jobLog("video.phase", { phase: "downloading" });
    enrichJob({ videoId: "v1" });

    expect(lines).toEqual([]);
  });
});

describe("runJob", () => {
  it("writes a start line and a completed end line with the job's fields", async () => {
    await runJob(attempt, async () => {
      enrichJob({ videoId: "v1" });
      jobLog("video.phase", { phase: "downloading" });
    });

    expect(lines.map((l) => l.event)).toEqual(["job.started", "video.phase", "job.ended"]);
    expect(lines[0]).toMatchObject({ job: "process-video", jobId: "job-1", attempt: 1, final: false });
    expect(lines[1]).toMatchObject({ job: "process-video", jobId: "job-1", videoId: "v1", phase: "downloading" });
    expect(lines[2]).toMatchObject({ outcome: "completed", videoId: "v1", attempt: 1, final: false });
    expect(typeof lines[2]!.durationMs).toBe("number");
    expect(lines[2]).not.toHaveProperty("error");
  });

  it("calls a failure that will be retried 'retrying' and rethrows it", async () => {
    await expect(
      runJob(attempt, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const end = lines.at(-1)!;
    expect(end).toMatchObject({ event: "job.ended", outcome: "retrying", final: false });
    expect(end.error).toMatchObject({ type: "Error", message: "boom", expected: false });
    expect((end.error as { stack?: string }).stack).toContain("boom");
  });

  it("calls the last failed attempt 'failed', and keeps no stack for an expected failure", async () => {
    class NotAVideo extends ExpectedJobError {
      name = "NotAVideo";
    }
    await expect(
      runJob({ ...attempt, attempt: 4, final: true }, async () => {
        throw new NotAVideo("no video stream");
      }),
    ).rejects.toThrow();

    const end = lines.at(-1)!;
    expect(end).toMatchObject({ outcome: "failed", final: true, attempt: 4 });
    expect(end.error).toEqual({ type: "NotAVideo", message: "no video stream", expected: true });
  });

  it("replaces a redacted value in every later line and in the error", async () => {
    await expect(
      runJob(attempt, async () => {
        redactInJob("abc+multipart");
        jobLog("video.phase", { phase: "downloading", note: "key abc+multipart" });
        throw new Error("ENOENT: open 'data/uploads/abc+multipart'");
      }),
    ).rejects.toThrow();

    const text = JSON.stringify(lines);
    expect(text).not.toContain("abc+multipart");
    expect(text).toContain(":redacted");
  });

  it("does not fail the job when logging throws", async () => {
    setWorkerEmit(() => {
      throw new Error("stdout closed");
    });
    let ran = false;

    await runJob(attempt, async () => {
      enrichJob({ videoId: "v1" });
      jobLog("video.phase", { phase: "downloading" });
      ran = true;
    });

    expect(ran).toBe(true);
  });
});

describe("describing an error", () => {
  it("reads the message and stack of an error pg-boss passes on as a plain object", () => {
    const cause = new Error("connection terminated (Queue: process-video, Worker: w1)");
    workerError("worker.error", { ...cause, message: cause.message, stack: cause.stack, queue: "process-video" });

    expect(lines[0]!.error).toEqual({
      type: "Error",
      message: "connection terminated (Queue: process-video, Worker: w1)",
      expected: false,
      stack: cause.stack,
    });
  });

  it("keeps the start and the end of a long message, since ffmpeg gives its reason last", async () => {
    await expect(
      runJob(attempt, async () => {
        throw new Error(`Command failed: ffmpeg${" -x".repeat(1000)}\nInvalid data found when processing input`);
      }),
    ).rejects.toThrow();

    const { message } = lines.at(-1)!.error as { message: string };
    expect(message.startsWith("Command failed: ffmpeg")).toBe(true);
    expect(message.endsWith("Invalid data found when processing input")).toBe(true);
    expect(message.length).toBeLessThanOrEqual(1003);
  });

  it("still ends the job, with the same error, when the thrown value cannot be read", async () => {
    const unreadable = Object.create(null);

    await expect(
      runJob(attempt, async () => {
        throw unreadable;
      }),
    ).rejects.toBe(unreadable);

    expect(lines.at(-1)).toMatchObject({
      event: "job.ended",
      outcome: "retrying",
      error: { type: "Unreadable", expected: false },
    });
  });
});

describe("pretty format", () => {
  it("is one readable line with the event first and no service or time noise", () => {
    const text = formatPretty({
      service: "worker",
      time: new Date(2026, 9, 17, 9, 30, 5, 123).toISOString(),
      event: "job.ended",
      job: "process-video",
      outcome: "completed",
      durationMs: 1234.5,
      error: { type: "Error", message: "boom", expected: false },
    });

    expect(text).toBe('09:30:05 job.ended job=process-video outcome=completed durationMs=1234.5 error={"type":"Error","message":"boom","expected":false}');
  });
});
