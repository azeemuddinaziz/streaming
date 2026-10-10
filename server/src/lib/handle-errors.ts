import type { ErrorRequestHandler } from "express";
import { HttpError } from "../errors.ts";
import { enrich } from "./wide-event.ts";

// Answers a failed request and records what went wrong on its wide event.
// `expected` tells a deliberate answer (a 404, 401, 409...) from a crash;
// only a crash carries a stack.
export const handleErrors: ErrorRequestHandler = (error, _req, res, _next) => {
  const known = error instanceof Error ? error : new Error(String(error));
  const tooLarge = (error as { type?: string }).type === "entity.too.large";

  if (error instanceof HttpError || tooLarge) {
    enrich({
      error: { type: known.name, message: known.message, expected: true },
    });
    const status = error instanceof HttpError ? error.status : 413;
    const msg = error instanceof HttpError ? error.message : "That image is over 5 MB.";
    return res.status(status).json({ msg });
  }

  enrich({
    error: {
      type: known.name,
      message: known.message,
      expected: false,
      stack: known.stack,
    },
  });
  return res.status(500).json({ msg: "Something went wrong." });
};
