import { config } from "@dotenvx/dotenvx";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: config({ path: ".env.test" }).parsed as any,
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
  },
});
