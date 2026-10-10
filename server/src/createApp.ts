import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Router } from "express";
import { handleErrors } from "./lib/handle-errors.ts";
import { mountAt, wideEvents } from "./lib/wide-event.ts";
import channelsRouter from "./routes/channels.routes.ts";
import mediaRouter from "./routes/media.routes.ts";
import uploadsRouter from "./routes/uploads.routes.ts";
import usersRouter from "./routes/users.routes.ts";
import videoRouter from "./routes/videos.routes.ts";
import webhooksRouter from "./routes/webhooks.routes.ts";

export function createApp() {
  const app = express();
  const router = Router();

  app.use(wideEvents);

  // The web app is served from another origin and sends the sign-in cookie.
  app.use(
    cors({
      origin: (origin, callback) =>
        callback(null, origin !== undefined && origin === process.env.WEB_ORIGIN),
      credentials: true,
      exposedHeaders: ["X-Request-Id", "Retry-After"],
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  router.get("/", mountAt("/api/v1"), (req, res) => {
    res.status(200).json({ msg: "Hello World!" });
  });

  router.use("/channels", mountAt("/api/v1/channels"), channelsRouter);
  router.use("/videos", mountAt("/api/v1/videos"), videoRouter);
  router.use("/webhooks", mountAt("/api/v1/webhooks"), webhooksRouter);
  router.use("/media", mountAt("/api/v1/media"), mediaRouter);
  router.use("/uploads", mountAt("/api/v1/uploads"), uploadsRouter);
  router.use("/users", mountAt("/api/v1/users"), usersRouter);

  app.use("/api/v1", router);
  app.use(handleErrors);

  return app;
}
