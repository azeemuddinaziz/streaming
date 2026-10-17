import "dotenv/config";
import { spawnSync } from "node:child_process";
import { storeDemoClip } from "./lib/seed-clip.ts";
import { prisma } from "./lib/prisma.ts";
import { queueVideoProcessing } from "./lib/video-queue.ts";
import { checkSeedEnvironment, parseSeedArgs, runSeed, SeedError, seedHelp } from "./services/seed.service.ts";

process.on("SIGINT", () => {
  console.log("\nInterrupted. Safe to run again.");
  process.exit(130);
});

const hasTool = (name: string) => spawnSync(name, ["-version"]).status === 0;

if (process.argv.slice(2).some((arg) => arg === "--help" || arg === "-h")) {
  console.log(seedHelp());
  process.exit(0);
}

try {
  const options = parseSeedArgs(process.argv.slice(2));
  checkSeedEnvironment(process.env, { ffmpeg: hasTool("ffmpeg") && hasTool("ffprobe") });
  await runSeed(options, {
    storeClip: storeDemoClip,
    queue: queueVideoProcessing,
    log: console.log,
  });
  await prisma.$disconnect();
  // The queue connection stays open for the API's sake; the seed is done with it.
  process.exit(0);
} catch (error) {
  console.error(error instanceof SeedError ? error.message : `Seed failed: ${(error as Error).message}`);
  process.exit(1);
}
