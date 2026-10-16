import { hashPassword } from "../utils/password.ts";
import { UserRepository } from "../repositories/users.repository.ts";
import { SeedRepository } from "../repositories/seed.repository.ts";

// A problem the person can fix; the entry file prints it without a stack.
export class SeedError extends Error {}

export const SEED_LIMITS = {
  users: { min: 1, max: 10, default: 3 },
  videos: { min: 1, max: 50, default: 6 },
} as const;

// Local-only, printed at the end so the demo accounts can be signed in to.
export const DEMO_PASSWORD = "demo-password";
// The seed's marker: its Uploads have a tusd id starting with this.
export const SEED_TUS_PREFIX = "seed-demo-";

const demoName = (n: number) => `demo-user-${n}`;
const demoEmail = (n: number) => `demo-user-${n}@seed.streamsouk.local`;
const tusIdFor = (n: number) => `${SEED_TUS_PREFIX}${n}`;

export type SeedOptions = { users: number; videos: number };

export type SeedDeps = {
  // Puts a generated clip in upload storage under `tusId`; returns its size in bytes.
  storeClip(tusId: string, index: number): Promise<number>;
  // Queues processing of a Video.
  queue(videoId: string): Promise<void>;
  log(line: string): void;
};

export function parseSeedArgs(argv: string[]): SeedOptions {
  const options: SeedOptions = { users: SEED_LIMITS.users.default, videos: SEED_LIMITS.videos.default };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]!.split("=")[0]!;
    if (flag !== "--users" && flag !== "--videos") {
      throw new SeedError(`Unknown option ${argv[i]}. Use --users N and --videos N.`);
    }
    const key = flag === "--users" ? "users" : "videos";
    const { min, max } = SEED_LIMITS[key];
    const raw = argv[i]!.includes("=") ? argv[i]!.slice(flag.length + 1) : argv[++i];
    const value = Number(raw);
    if (raw === undefined || !/^\d+$/.test(raw) || value < min || value > max) {
      throw new SeedError(`${flag} must be a whole number from ${min} to ${max}.`);
    }
    options[key] = value;
  }
  return options;
}

export function checkSeedEnvironment(
  env: Record<string, string | undefined>,
  tools: { ffmpeg: boolean },
) {
  if (env.NODE_ENV === "production") {
    throw new SeedError("Refusing to seed demo data when NODE_ENV is production.");
  }
  if (env.S3_BUCKET) {
    throw new SeedError("Refusing to seed while S3_BUCKET is set: the seed only uses disk storage.");
  }
  if (!tools.ffmpeg) {
    throw new SeedError("ffmpeg and ffprobe are required to generate the demo clips, and were not found on the PATH.");
  }
}

const TOPICS = [
  "Test pattern tour", "Color bars and a sine tone", "A short signal check", "Moving gradients",
  "Pixels in motion", "Frame counter demo", "Tone and picture sync", "Eight seconds of nothing",
];

export type SeedSummary = { usersCreated: number; usersFound: number; videosCreated: number; videosFound: number };

export async function runSeed({ users, videos }: SeedOptions, deps: SeedDeps): Promise<SeedSummary> {
  const { log } = deps;
  log(`Seeding demo data: ${users} demo Users, ${videos} Videos (one in 6 Unlisted, the rest Public).`);

  // 1. Demo Users. Everything is checked before anything is written.
  log("[1/3] Demo Users");
  const numbers = Array.from({ length: users }, (_, i) => i + 1);
  const existing = new Map(
    (await SeedRepository.findUsersByName(numbers.map((n) => demoName(n)))).map((u) => [u.nameKey, u]),
  );
  for (const n of numbers) {
    const found = existing.get(demoName(n));
    if (found && found.email !== demoEmail(n)) {
      throw new SeedError(
        `The account "${found.name}" already exists and is not a demo User (different email). Nothing was changed.`,
      );
    }
    if (!found && (await SeedRepository.findUserByEmail(demoEmail(n)))) {
      throw new SeedError(`The email ${demoEmail(n)} already belongs to another account. Nothing was changed.`);
    }
  }
  const owners: { id: string }[] = [];
  const summary: SeedSummary = { usersCreated: 0, usersFound: 0, videosCreated: 0, videosFound: 0 };
  for (const n of numbers) {
    const found = existing.get(demoName(n));
    if (found) {
      owners.push(found);
      summary.usersFound++;
      log(`  ${demoName(n)}: already there`);
    } else {
      owners.push(
        await UserRepository.createWithChannel({
          email: demoEmail(n),
          name: demoName(n),
          nameKey: demoName(n),
          password: await hashPassword(DEMO_PASSWORD),
        }),
      );
      summary.usersCreated++;
      log(`  ${demoName(n)}: created`);
    }
  }

  // 2. Videos, each from a finished Upload through the real pipeline.
  log("[2/3] Videos");
  const seeded = await SeedRepository.findSeededUploads(SEED_TUS_PREFIX);
  const have = new Set(seeded.map((u) => u.tusId));
  for (let n = 1; n <= videos; n++) {
    const tusId = tusIdFor(n);
    if (have.has(tusId)) {
      summary.videosFound++;
      log(`  Video ${n} of ${videos}: already there`);
      continue;
    }
    const size = await deps.storeClip(tusId, n);
    const video = await SeedRepository.createVideoFromUpload({
      userId: owners[(n - 1) % owners.length]!.id,
      tusId,
      filename: `demo-clip-${n}.mp4`,
      size,
      title: `${TOPICS[(n - 1) % TOPICS.length]} #${n}`,
      description: `Demo Video ${n}, generated by the seed from an ffmpeg test pattern.`,
      visibility: n % 6 === 0 ? "UNLISTED" : "PUBLIC",
    });
    try {
      await deps.queue(video.id);
      log(`  Video ${n} of ${videos}: created, processing queued`);
    } catch {
      await SeedRepository.markFailed(video.id);
      log(`  Video ${n} of ${videos}: created, but queueing failed (marked Failed; use Retry in Studio)`);
    }
    summary.videosCreated++;
  }
  if (seeded.length > videos) {
    log(`  ${seeded.length} seeded Videos exist, you asked for ${videos}, nothing removed`);
  }

  // 3. Summary
  log("[3/3] Done");
  log(`  Users: ${summary.usersCreated} created, ${summary.usersFound} found`);
  log(`  Videos: ${summary.videosCreated} created, ${summary.videosFound} found`);
  if (summary.videosCreated + summary.usersCreated === 0) log("  Nothing new was created.");
  if (summary.videosCreated > 0) log("  Start the worker (pnpm --filter server worker) so the new Videos get processed.");
  log(`Demo sign-in (local only), password "${DEMO_PASSWORD}":`);
  for (const n of numbers) log(`  ${demoEmail(n)}`);
  return summary;
}
