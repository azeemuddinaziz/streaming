import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export type WideEvent = Record<string, unknown>;

const store = new AsyncLocalStorage<WideEvent>();

// Where finished events go: one JSON line on stdout. Every event is kept (no
// sampling yet). Tests swap this with `setEmit` to collect events.
const writeLine = (event: WideEvent) => {
  if (process.env.NODE_ENV === "test") return;
  process.stdout.write(`${JSON.stringify(event)}\n`);
};
let emitEvent: (event: WideEvent) => void = writeLine;

export function setEmit(fn: ((event: WideEvent) => void) | null) {
  emitEvent = fn ?? writeLine;
}

export function emit(event: WideEvent) {
  try {
    emitEvent(event);
  } catch {
    // Logging must never break a request.
  }
}

// Adds fields to the current request's event. Does nothing outside a request.
export function enrich(fields: WideEvent) {
  try {
    const event = store.getStore();
    if (event) Object.assign(event, fields);
  } catch {
    // Never throws.
  }
}

// The media address carries a credential as its first segment.
function redactPath(path: string) {
  return path.replace(/^(\/api\/v1\/media\/)[^/]+/i, "$1:token");
}

// The pattern is the mount point recorded by `mountAt` plus the route's own
// path (`req.baseUrl` holds the concrete address, so it cannot be used).
function routePattern(req: Request, res: Response) {
  const route = req.route?.path;
  if (typeof route !== "string") return null;
  const mount: string = res.locals.mount ?? "";
  return `${mount}${route === "/" ? "" : route}` || "/";
}

// Records where a router is mounted, for the route pattern of its events.
export function mountAt(path: string) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.locals.mount = path;
    next();
  };
}

export function wideEvents(req: Request, res: Response, next: NextFunction) {
  const startedAt = process.hrtime.bigint();
  const requestId = randomUUID();
  const event: WideEvent = {};
  let emitted = false;

  res.setHeader("X-Request-Id", requestId);

  const finish = () => {
    if (emitted) return;
    emitted = true;
    const aborted = !res.writableFinished;
    emit({
      ...event,
      requestId,
      service: "api",
      environment: process.env.NODE_ENV ?? "development",
      method: req.method,
      route: routePattern(req, res),
      path: redactPath(req.originalUrl.split("?")[0] ?? ""),
      status: res.headersSent || !aborted ? res.statusCode : null,
      aborted,
      durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6,
      ...(req.user ? { userId: req.user.id } : {}),
      ...(req.channel ? { channelId: req.channel.id } : {}),
    });
  };
  res.once("finish", finish);
  res.once("close", finish);

  store.run(event, next);
}
