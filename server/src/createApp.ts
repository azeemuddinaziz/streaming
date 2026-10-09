import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Router, type ErrorRequestHandler } from "express";
import { HttpError } from "./errors.ts";
import mediaRouter from "./routes/media.routes.ts";
import uploadsRouter from "./routes/uploads.routes.ts";
import usersRouter from "./routes/users.routes.ts";
import videoRouter from "./routes/videos.routes.ts";
import webhooksRouter from "./routes/webhooks.routes.ts";

const handleErrors: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ msg: error.message });
  }

  console.error(error);
  return res.status(500).json({ msg: "Something went wrong." });
};

export function createApp() {
  const app = express();
  const router = Router();

  // The web app is served from another origin and sends the sign-in cookie.
  app.use(
    cors({
      origin: (origin, callback) =>
        callback(null, origin !== undefined && origin === process.env.WEB_ORIGIN),
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  router.get("/", (req, res) => {
    res.status(200).json({ msg: "Hello World!" });
  });

  router.use("/videos", videoRouter);
  router.use("/webhooks", webhooksRouter);
  router.use("/media", mediaRouter);
  router.use("/uploads", uploadsRouter);
  router.use("/users", usersRouter);

  app.use("/api/v1", router);
  app.use(handleErrors);

  return app;
}
