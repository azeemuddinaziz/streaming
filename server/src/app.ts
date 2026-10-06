import cookieParser from "cookie-parser";
import "dotenv/config";
import express, { Router } from "express";
import usersRouter from "./routes/users.routes.ts";
import videoRouter from "./routes/videos.routes.ts";
import webhooksRouter from "./routes/webhooks.routes.ts";

const app = express();
const router = Router();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());

router.get("/", (req, res) => {
  res.status(200).json({ msg: "Hello World!" });
});

router.use("/videos", videoRouter);
router.use("/webhooks", webhooksRouter);
router.use("/users", usersRouter);

app.use("/api/v1", router);

app.listen(port, () => {
  console.log(`Server live at http://localhost:${port}`);
});
