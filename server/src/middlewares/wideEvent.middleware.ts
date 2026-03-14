import type { NextFunction, Request, Response } from "express";
import { storage } from "../app.js";
import { ENV } from "../config/env.js";
import logger from "../utils/logger.js";

export function wideEventMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const context = storage.getStore();

    if (!context) {
      return next();
    }

    const event: Record<string, unknown> = {
      request_id: context.requestId,
      service: { name: ENV.SERVICE_NAME, version: ENV.SERVICE_VERSION },
      http: { method: req.method, path: req.path },

      identity: {},
      payload: {},
      performance: {},
      error: null,

      timestamp: new Date().toISOString(),
    };

    req.wideEvent = event;

    // Listen for the response to finish
    res.on("finish", () => {
      event.duration_ms = Date.now() - startTime;
      event.status_code = res.statusCode;
      event.outcome = res.statusCode < 400 ? "success" : "error";

      logger.info(event);
    });

    next();
  };
}
