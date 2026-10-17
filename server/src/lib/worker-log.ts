import { AsyncLocalStorage } from "node:async_hooks";
import { errorType } from "./wide-event.ts";

// The worker's counterpart of the API's wide events. A request has one event
// built while it runs; a job is long and silent, so the worker writes one JSON
// line per thing that happened instead (start, phase, end), each carrying the
// job's context. Only named fields are written, never tusd ids, tokens, file
// bytes or Video and Comment text.
export type WorkerLine = Record<string, unknown>;

export type JobAttemptInfo = {
  job: string;
  jobId: string;
  // 1 for the first run, 2 for the first retry, ...
  attempt: number;
  // True when the job will not be run again if this attempt fails.
  final: boolean;
};

// A failure the job foresees (a file that is not a video), logged without a
// stack. Anything else is unexpected and keeps its stack.
export class ExpectedJobError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ExpectedJobError";
  }
}

type JobContext = {
  fields: WorkerLine;
  // Values that must never be written (a tusd id), replaced in every line.
  secrets: string[];
};

const store = new AsyncLocalStorage<JobContext>();

// A long error message keeps its start and its end (ffmpeg gives its reason
// last), up to this many characters of each.
const MESSAGE_HEAD = 300;
const MESSAGE_TAIL = 700;

// "HH:MM:SS event key=value ...", in local time, for reading in a terminal.
export function formatPretty(line: WorkerLine) {
  const { service: _service, environment: _environment, time, event, ...rest } = line;
  const clock = typeof time === "string" ? new Date(time).toTimeString().slice(0, 8) : "";
  const pairs = Object.entries(rest).map(([key, value]) => {
    const shown = value !== null && typeof value === "object" ? JSON.stringify(value) : String(value);
    return `${key}=${shown}`;
  });
  return [clock, event, ...pairs].join(" ");
}

// One JSON line on stdout, or a readable one with LOG_FORMAT=pretty. Silent in
// tests, which swap this with `setWorkerEmit` to collect lines.
const writeLine = (line: WorkerLine) => {
  if (process.env.NODE_ENV === "test") return;
  if (process.env.LOG_FORMAT === "pretty") {
    const error = line.error as { stack?: string } | undefined;
    const shown = error?.stack ? { ...line, error: { ...error, stack: undefined } } : line;
    process.stdout.write(`${formatPretty(shown)}\n${error?.stack ? `${error.stack}\n` : ""}`);
    return;
  }
  process.stdout.write(`${JSON.stringify(line)}\n`);
};
let emitLine: (line: WorkerLine) => void = writeLine;

export function setWorkerEmit(fn: ((line: WorkerLine) => void) | null) {
  emitLine = fn ?? writeLine;
}

function redact(line: WorkerLine, secrets: string[]): WorkerLine {
  if (secrets.length === 0) return line;
  let text = JSON.stringify(line);
  for (const secret of secrets) {
    text = text.split(JSON.stringify(secret).slice(1, -1)).join(":redacted");
  }
  return JSON.parse(text);
}

// Writes a line. Inside a job it also carries the job's fields and hides its
// redacted values. Never throws.
export function workerLog(event: string, fields: WorkerLine = {}) {
  try {
    const context = store.getStore();
    const line = {
      service: "worker",
      environment: process.env.NODE_ENV ?? "development",
      time: new Date().toISOString(),
      event,
      ...context?.fields,
      ...fields,
    };
    emitLine(context ? redact(line, context.secrets) : line);
  } catch {
    // Logging must never break the worker or a job.
  }
}

// Writes a line inside the current job, with its context. Does nothing outside
// a job, so the same service code is quiet when the seed or a test runs it.
export function jobLog(event: string, fields: WorkerLine = {}) {
  if (store.getStore()) workerLog(event, fields);
}

// Adds fields (such as `videoId`) to every later line of the current job,
// its end line included. Does nothing outside a job.
export function enrichJob(fields: WorkerLine) {
  try {
    const context = store.getStore();
    if (context) Object.assign(context.fields, fields);
  } catch {
    // Never throws.
  }
}

// Keeps values (a tusd id, a capability) out of every later line of the
// current job, including the message and stack of the error that ends it.
export function redactInJob(...secrets: string[]) {
  try {
    const context = store.getStore();
    if (context) context.secrets.push(...secrets.filter(Boolean));
  } catch {
    // Never throws.
  }
}

function shorten(message: string) {
  if (message.length <= MESSAGE_HEAD + MESSAGE_TAIL) return message;
  return `${message.slice(0, MESSAGE_HEAD)} … ${message.slice(-MESSAGE_TAIL)}`;
}

// `{ type, message, expected, stack? }`, as the API's wide events. pg-boss
// passes some of its errors on as plain objects, so any object's message and
// stack are read. Never throws, whatever was thrown.
export function describeError(error: unknown) {
  try {
    const expected = error instanceof ExpectedJobError;
    const fields: { name?: unknown; message?: unknown; stack?: unknown } =
      typeof error === "object" && error !== null ? error : {};
    const hasMessage = typeof fields.message === "string";
    return {
      type: typeof fields.name === "string" ? fields.name : hasMessage ? "Error" : errorType(error),
      message: shorten(hasMessage ? (fields.message as string) : String(error)),
      expected,
      ...(!expected && typeof fields.stack === "string" ? { stack: fields.stack } : {}),
    };
  } catch {
    return { type: "Unreadable", message: "The error could not be read.", expected: false };
  }
}

// Runs one attempt of a job between a start line and an end line. The end line
// says `completed`, `retrying` (failed, will run again) or `failed` (the last
// attempt failed), and the error is rethrown for the job runner.
export async function runJob(info: JobAttemptInfo, run: () => Promise<void>) {
  const context: JobContext = { fields: { ...info }, secrets: [] };
  return store.run(context, async () => {
    const startedAt = process.hrtime.bigint();
    const durationMs = () => Number(process.hrtime.bigint() - startedAt) / 1e6;
    workerLog("job.started");
    try {
      await run();
    } catch (error) {
      workerLog("job.ended", {
        outcome: info.final ? "failed" : "retrying",
        durationMs: durationMs(),
        error: describeError(error),
      });
      throw error;
    }
    workerLog("job.ended", { outcome: "completed", durationMs: durationMs() });
  });
}

// A line about a failure, such as the job runner's own errors.
export function workerError(event: string, error: unknown) {
  workerLog(event, { error: describeError(error) });
}
