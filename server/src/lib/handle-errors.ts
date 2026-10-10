import type { ErrorRequestHandler } from "express";
import { HttpError } from "../errors.ts";
import { enrich } from "./wide-event.ts";

// Answers a failed request and records what went wrong on its wide event.
// `expected` tells a deliberate answer (a 404, 401, 409...) from a crash;
// only a crash carries a stack.
export const handleErrors: ErrorRequestHandler = (error, _req, res, _next) => {
  const asError = error instanceof Error ? error : new Error(String(error));
  const describe = (expected: boolean, stack?: string) =>
    enrich({
      error: {
        type: asError.name,
        message: asError.message,
        expected,
        ...(stack ? { stack } : {}),
      },
    });

  if (error instanceof HttpError) {
    describe(true);
    return res.status(error.status).json({ msg: error.message });
  }

  if ((error as { type?: string }).type === "entity.too.large") {
    describe(true);
    return res.status(413).json({ msg: "That image is over 5 MB." });
  }

  describe(false, error instanceof Error ? error.stack : undefined);
  return res.status(500).json({ msg: "Something went wrong." });
};
