import "dotenv/config";
import { defineConfig } from "vitest/config";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is not set. Tests wipe this database, so it must be separate from DATABASE_URL.",
  );
}
if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL.");
}

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: testDatabaseUrl,
      JWT_SECRET: "test-secret-that-is-only-used-by-the-test-suite",
      WEB_ORIGIN: "http://localhost:3001",
    },
    // Tests share one database, so test files run one at a time.
    fileParallelism: false,
  },
});
