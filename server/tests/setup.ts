// tests/setup.ts
import { config } from "@dotenvx/dotenvx";
import { afterAll, afterEach, beforeAll } from "vitest";
import { prisma } from "../src/lib/prisma";

config({ path: "./.env.test" });

/**
 * Runs once before the entire test suite starts.
 */
beforeAll(async () => {
  // Check if we are connected or if migrations are needed
  await prisma.$connect();
});

/**
 * Runs AFTER EVERY SINGLE 'it' or 'test' block.
 * This is the most important part!
 */
afterEach(async () => {
  // We delete in order of dependencies (Child first, then Parent)
  // Uploads depend on Users, so delete Uploads first.
  await prisma.upload.deleteMany();
  await prisma.user.deleteMany();
});

/**
 * Runs once after all tests in the file are finished.
 */
afterAll(async () => {
  await prisma.$disconnect();
});
