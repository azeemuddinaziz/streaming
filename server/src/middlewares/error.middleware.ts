import { NextFunction, Request, Response } from "express";

/**
 * Global Error Handler Middleware
 * Catches all errors passed to next() or thrown in asyncHandler.
 */
export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const statusCode = err.statusCode || 500;
  const status = err.status || "error";

  // 1. Enrich the wideEvent with the error details
  if (req.wideEvent) {
    req.wideEvent.error = {
      message: err.message,
      code: statusCode,
      // Only log stack trace in development mode
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    };
  }

  // 2. Send the standardized response
  res.status(statusCode).json({
    status: status,
    message: err.message,
    // Provide extra detail for validation errors or dev mode
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
