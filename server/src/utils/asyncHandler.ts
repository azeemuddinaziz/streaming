import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wraps an asynchronous Express route handler to catch errors and pass them to the error middleware.
 * @param handler The asynchronous request handler function.
 * @returns An Express RequestHandler.
 */
const asyncHandler = (handler: RequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

export default asyncHandler;
