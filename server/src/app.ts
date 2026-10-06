import "dotenv/config";
import { createApp } from "./createApp.ts";

const app = createApp();
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server live at http://localhost:${port}`);
});
