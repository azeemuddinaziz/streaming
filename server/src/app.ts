import cookieParser from "cookie-parser";
import express, { NextFunction, Request, Response } from "express";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { RequestContext } from "./types/express.js";

const storage = new AsyncLocalStorage<RequestContext>();

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use((req: Request, res: Response, next: NextFunction) => {
  req.id = req.get("X-Request-ID") || randomUUID();
  res.set("X-Request-ID", req.id);
  storage.run({ requestId: req.id }, () => next());
});

import { globalErrorHandler } from "./middlewares/error.middleware.js";
import { authRouter } from "./routes/v1/auth.routes.js";
import { uploadRouter } from "./routes/v1/upload.routes.js";

app.use("/auth", authRouter);
app.use("/upload", uploadRouter);

// The Global Error Handler (MUST BE LAST)
app.use(globalErrorHandler);

export { app, storage };
