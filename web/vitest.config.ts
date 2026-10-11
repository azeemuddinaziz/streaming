import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Logic tests run in node. A component test opts into the browser-like
// environment with `// @vitest-environment jsdom` on its first line.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { setupFiles: ["./src/test/setup.ts"] },
});
