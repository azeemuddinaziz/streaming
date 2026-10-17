import { hashPassword } from "../utils/password.ts";
import { UserRepository } from "../repositories/users.repository.ts";
import { DEMO_EMAIL_DOMAIN, SeedRepository } from "../repositories/seed.repository.ts";
import { VideoRepository } from "../repositories/videos.repository.ts";
import { HttpError } from "../errors.ts";
import { ChannelRepository } from "../repositories/channels.repository.ts";
import { ReactionRepository } from "../repositories/reactions.repository.ts";
import { SubscriptionRepository } from "../repositories/subscriptions.repository.ts";
import { CommentService } from "./comments.service.ts";
import { ReactionService } from "./reactions.service.ts";
import { SubscriptionService } from "./subscriptions.service.ts";

// A problem the person can fix; the entry file prints it without a stack.
export class SeedError extends Error {}

export const SEED_LIMITS = {
  users: { min: 1, max: 10, default: 3 },
  videos: { min: 1, max: 50, default: 6 },
  commentsPerVideo: { min: 0, max: 10, default: 2 },
} as const;

// Local-only, printed at the end so the demo accounts can be signed in to.
export const DEMO_PASSWORD = "demo-password";
// The seed's marker: its Uploads have a tusd id starting with this.
export const SEED_TUS_PREFIX = "seed-demo-";

const demoName = (n: number) => `demo-user-${n}`;
const demoEmail = (n: number) => `demo-user-${n}${DEMO_EMAIL_DOMAIN}`;
const tusIdFor = (n: number) => `${SEED_TUS_PREFIX}${n}`;

export type SeedOptions = { users: number; videos: number; commentsPerVideo: number };

export type SeedDeps = {
  // Puts a generated clip in upload storage under `tusId`; returns its size in bytes.
  storeClip(tusId: string, index: number): Promise<number>;
  // Queues processing of a Video.
  queue(videoId: string): Promise<void>;
  log(line: string): void;
  // How the wait for processing passes time; tests replace these so Videos can
  // be processed (or not) without a worker and without real waiting.
  sleep?(ms: number): Promise<void>;
  now?(): number;
  pollMs?: number;
  timeoutMs?: number;
};

export const WAIT_POLL_MS = 3_000;
export const WAIT_TIMEOUT_MS = 5 * 60_000;

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const seededNumber = (tusId: string) => Number(tusId.slice(SEED_TUS_PREFIX.length));
// Replies under the k-th top-level Comment: two on k = 1, 5, ..., one on k = 3, 7, ...
const repliesFor = (k: number) => (k % 4 === 1 ? 2 : k % 4 === 3 ? 1 : 0);
// A write refused this many times in a row is not going to pass.
const MAX_RATE_LIMIT_WAITS = 20;

const clock = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
const noun = (n: number) => `${n} Video${n === 1 ? "" : "s"}`;

const FLAGS = { "--users": "users", "--videos": "videos", "--comments-per-video": "commentsPerVideo" } as const;

export function parseSeedArgs(argv: string[]): SeedOptions {
  const options: SeedOptions = {
    users: SEED_LIMITS.users.default,
    videos: SEED_LIMITS.videos.default,
    commentsPerVideo: SEED_LIMITS.commentsPerVideo.default,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]!.split("=")[0]!;
    if (!Object.hasOwn(FLAGS, flag)) {
      throw new SeedError(`Unknown option ${argv[i]}. Use --users N, --videos N and --comments-per-video N.`);
    }
    const key = FLAGS[flag as keyof typeof FLAGS];
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

export type SeedSummary = {
  usersCreated: number;
  usersFound: number;
  videosCreated: number;
  videosFound: number;
  commentsWritten: number;
  commentsFound: number;
  reactionsWritten: number;
  reactionsFound: number;
  subscriptionsWritten: number;
  subscriptionsFound: number;
};

const COMMENTS = [
  "Great test pattern, the colors look sharp.", "Is that a sine tone I hear?", "Short and sweet.",
  "Watching this on my phone, plays smoothly.", "The gradient transition is lovely.", "Perfect for checking my setup.",
  "Audio and picture are in sync here.", "Nice little demo clip.", "I replayed this three times.",
  "Looks great at every quality setting.", "Simple, clean and useful.", "Thanks for sharing this one.",
];
const REPLIES = [
  "Agreed!", "Same here.", "Good catch.", "I noticed that too.", "Thanks for watching.", "Glad it helps.",
];

// Runs a write through a service, waiting out a 429 for as long as it says.
// `what` names the limit in the log ("comment", "reaction", "subscription").
async function waitingOutLimit<T>(deps: SeedDeps, what: string, write: () => Promise<T>): Promise<T> {
  const sleep = deps.sleep ?? defaultSleep;
  for (let waits = 0; ; waits++) {
    try {
      return await write();
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 429) throw error;
      if (waits >= MAX_RATE_LIMIT_WAITS) {
        throw new SeedError(`The ${what} rate limit keeps refusing writes. Run the seed again later to continue.`);
      }
      const seconds = Number(error.headers["Retry-After"]) || 60;
      deps.log(`  ${what} rate limit reached, waiting ${seconds}s`);
      await sleep(seconds * 1000);
    }
  }
}

// Writes `text` through the Comment service, waiting out the write limit.
// A demo User already having written that text there counts as written.
async function writeComment(
  deps: SeedDeps,
  c: { videoId: string; authorId: string; text: string; parentId: string | null },
): Promise<{ id: string; written: boolean }> {
  const found = await SeedRepository.findComment(c.videoId, c.text, c.parentId);
  if (found) return { id: found.id, written: false };
  const made = await waitingOutLimit(deps, "comment", () =>
    CommentService.create(c.authorId, c.videoId, c.text, c.parentId),
  );
  return { id: made.id, written: true };
}

type Kind = "LIKE" | "DISLIKE";
// Mostly Likes; every fifth pairing is a Dislike so the owner's count shows.
const kindFor = (seed: number): Kind => (seed % 5 === 0 ? "DISLIKE" : "LIKE");

// Polls until every Video is READY. Throws a SeedError on timeout, or when
// nothing is left processing but some failed; running the seed again waits on
// the first and re-queues the second.
async function waitForReady(videoIds: string[], deps: SeedDeps) {
  const { log } = deps;
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? Date.now;
  const pollMs = deps.pollMs ?? WAIT_POLL_MS;
  const timeoutMs = deps.timeoutMs ?? WAIT_TIMEOUT_MS;
  const started = now();
  let announced = false;

  for (;;) {
    const rows = await SeedRepository.statusesOf(videoIds);
    const ready = rows.filter((v) => v.status === "READY").length;
    const processing = rows.filter((v) => v.status === "PROCESSING").length;
    const failed = rows.length - ready - processing;
    if (processing === 0 && failed === 0) {
      log(`  all ready (${ready}/${rows.length})`);
      return;
    }
    if (processing === 0) {
      throw new SeedError(`${noun(failed)} failed to process. Run the seed again to queue them again.`);
    }
    if (!announced) {
      log("  Waiting for the worker. If nothing moves, start it: pnpm --filter server worker");
      announced = true;
    }
    const elapsed = now() - started;
    log(`  ${ready}/${rows.length} ready, ${processing} processing${failed ? `, ${failed} failed` : ""}, elapsed ${clock(elapsed)}`);
    if (elapsed >= timeoutMs) {
      throw new SeedError(`${noun(processing)} still processing. Is the worker running? Run the seed again to continue.`);
    }
    await sleep(pollMs);
  }
}

export async function runSeed({ users, videos, commentsPerVideo }: SeedOptions, deps: SeedDeps): Promise<SeedSummary> {
  const { log } = deps;
  log(`Seeding demo data: ${users} demo Users, ${videos} Videos (one in 6 Unlisted, the rest Public), ${commentsPerVideo} Comments each, with Reactions and Subscriptions.`);

  // 1. Demo Users. Everything is checked before anything is written.
  log("[1/7] Demo Users");
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
  const summary: SeedSummary = { usersCreated: 0, usersFound: 0, videosCreated: 0, videosFound: 0, commentsWritten: 0, commentsFound: 0, reactionsWritten: 0, reactionsFound: 0, subscriptionsWritten: 0, subscriptionsFound: 0 };
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
  log("[2/7] Videos");
  const seeded = await SeedRepository.findSeededUploads(SEED_TUS_PREFIX);
  const have = new Map(seeded.map((u) => [u.tusId, u.video]));
  for (let n = 1; n <= videos; n++) {
    const tusId = tusIdFor(n);
    if (have.has(tusId)) {
      summary.videosFound++;
      const existing = have.get(tusId);
      // Same claim as the owner's Retry: only a FAILED Video is taken, so no work is doubled.
      if (existing && !existing.deletedAt && existing.status === "FAILED" && (await VideoRepository.restartProcessing(existing.id))) {
        try {
          await deps.queue(existing.id);
          log(`  Video ${n} of ${videos}: was Failed, processing queued again`);
        } catch {
          await SeedRepository.markFailed(existing.id);
          log(`  Video ${n} of ${videos}: was Failed, queueing failed again (marked Failed)`);
        }
        continue;
      }
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

  // 3. Wait for the worker to make them Ready.
  log("[3/7] Processing");
  await waitForReady(
    (await SeedRepository.findSeededUploads(SEED_TUS_PREFIX))
      .filter((u) => seededNumber(u.tusId) <= videos && u.video && !u.video.deletedAt)
      .map((u) => u.video!.id),
    deps,
  );

  // 4. Comments and Replies on the READY Videos, through the real service.
  log("[4/7] Comments");
  const ready = (await SeedRepository.findSeededUploads(SEED_TUS_PREFIX))
    .filter((u) => seededNumber(u.tusId) <= videos && u.video?.status === "READY" && !u.video.deletedAt)
    .sort((x, y) => seededNumber(x.tusId) - seededNumber(y.tusId));
  const tally = (r: { written: boolean }) => void (r.written ? summary.commentsWritten++ : summary.commentsFound++);
  for (const upload of ready) {
    const n = seededNumber(upload.tusId);
    const videoId = upload.video!.id;
    for (let k = 0; k < commentsPerVideo; k++) {
      const authorIndex = (n + k) % owners.length;
      const top = await writeComment(deps, {
        videoId, authorId: owners[authorIndex]!.id, text: COMMENTS[(n + k) % COMMENTS.length]!, parentId: null,
      });
      tally(top);
      // Replies come from the next User; a lone User does not answer themself.
      for (let r = 0; r < (owners.length > 1 ? repliesFor(k) : 0); r++) {
        tally(await writeComment(deps, {
          videoId, authorId: owners[(authorIndex + 1 + r) % owners.length]!.id,
          text: REPLIES[(n + k + r) % REPLIES.length]!, parentId: top.id,
        }));
      }
    }
  }
  log(`  Comments and Replies: ${summary.commentsWritten} written, ${summary.commentsFound} already there`);

  // 5. Reactions from the other demo Users, on the Videos and on their Comments.
  log("[5/7] Reactions");
  const userIds = owners.map((o) => o.id);
  const react = async (
    target: { videoId?: string; commentId?: string; authorId: string },
    index: number,
  ) => {
    // Everyone but the one who wrote it; a lone User has nobody to react.
    const others = userIds.filter((id) => id !== target.authorId);
    for (const [j, userId] of others.entries()) {
      const kind = kindFor(index + j);
      const had = target.commentId
        ? await ReactionRepository.findOnComment(userId, target.commentId)
        : await ReactionRepository.find(userId, target.videoId!);
      if (had === kind) {
        summary.reactionsFound++;
        continue;
      }
      await waitingOutLimit(deps, "reaction", () =>
        target.commentId
          ? ReactionService.setOnComment(userId, target.videoId!, target.commentId, kind)
          : ReactionService.set(userId, target.videoId!, kind),
      );
      summary.reactionsWritten++;
    }
  };
  for (const upload of ready) {
    const n = seededNumber(upload.tusId);
    await react({ videoId: upload.video!.id, authorId: upload.userId }, n);
  }
  const readyIds = ready.map((u) => u.video!.id);
  const seededComments = await SeedRepository.findSeededComments(readyIds);
  for (const [i, comment] of seededComments.entries()) {
    await react(
      { videoId: comment.videoId, commentId: comment.id, authorId: comment.authorId },
      i,
    );
  }
  log(`  Reactions: ${summary.reactionsWritten} written, ${summary.reactionsFound} already there`);

  // 6. Subscriptions as a ring: User i subscribes to User i+1's Channel.
  log("[6/7] Subscriptions");
  if (owners.length < 2) {
    log("  Skipped: a lone User cannot subscribe to their own Channel");
  } else {
    for (const [i, owner] of owners.entries()) {
      const name = demoName(numbers[(i + 1) % numbers.length]!);
      const channel = (await ChannelRepository.findByName(name))?.channel;
      if (channel && (await SubscriptionRepository.exists(owner.id, channel.id))) {
        summary.subscriptionsFound++;
        continue;
      }
      await waitingOutLimit(deps, "subscription", () => SubscriptionService.subscribe(owner.id, name));
      summary.subscriptionsWritten++;
    }
  }
  log(`  Subscriptions: ${summary.subscriptionsWritten} written, ${summary.subscriptionsFound} already there`);

  // 7. Summary
  log("[7/7] Done");
  log(`  Users: ${summary.usersCreated} created, ${summary.usersFound} found`);
  log(`  Comments and Replies: ${summary.commentsWritten} written, ${summary.commentsFound} already there`);
  log(`  Reactions: ${summary.reactionsWritten} written, ${summary.reactionsFound} already there`);
  log(`  Subscriptions: ${summary.subscriptionsWritten} written, ${summary.subscriptionsFound} already there`);
  log(`  Videos: ${summary.videosCreated} created, ${summary.videosFound} found`);
  if (summary.videosCreated + summary.usersCreated + summary.commentsWritten + summary.reactionsWritten + summary.subscriptionsWritten === 0) log("  Nothing new was created.");
  log(`Demo sign-in (local only), password "${DEMO_PASSWORD}":`);
  for (const n of numbers) log(`  ${demoEmail(n)}`);
  return summary;
}
