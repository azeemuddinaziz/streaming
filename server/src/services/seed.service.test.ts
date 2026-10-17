import { spawnSync } from "node:child_process";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.ts";
import { storeDemoClip } from "../lib/seed-clip.ts";
import { UserRepository } from "../repositories/users.repository.ts";
import { resetDatabase } from "../test/helpers.ts";
import { checkSeedEnvironment, parseSeedArgs, runSeed, SeedError } from "./seed.service.ts";

beforeEach(async () => {
  await resetDatabase();
});

function deps() {
  const logs: string[] = [];
  const queued: string[] = [];
  const stored: string[] = [];
  return {
    logs, queued, stored,
    storeClip: async (tusId: string) => (stored.push(tusId), 1234),
    queue: async (id: string) => void queued.push(id),
    log: (line: string) => void logs.push(line),
    // Stands in for the worker: each wait makes every processing Video ready.
    sleep: async () => void (await prisma.video.updateMany({ where: { status: "PROCESSING" }, data: { status: "READY" } })),
  };
}

// A clock that moves only when the seed sleeps, so a timeout takes no real time.
function fakeClock() {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => void (t += ms) };
}

describe("parseSeedArgs", () => {
  it("defaults to 3 Users and 6 Videos", () => {
    expect(parseSeedArgs([])).toEqual({ users: 3, videos: 6 });
  });
  it("reads both flag styles", () => {
    expect(parseSeedArgs(["--users", "2", "--videos=9"])).toEqual({ users: 2, videos: 9 });
  });
  it.each([
    [["--users", "0"], "--users must be a whole number from 1 to 10"],
    [["--users", "11"], "--users must be a whole number from 1 to 10"],
    [["--videos", "51"], "--videos must be a whole number from 1 to 50"],
    [["--videos", "x"], "--videos must be a whole number from 1 to 50"],
    [["--videos"], "--videos must be a whole number from 1 to 50"],
  ])("rejects %j naming the flag and range", (argv, message) => {
    expect(() => parseSeedArgs(argv)).toThrow(message);
  });
  it("rejects an unknown flag", () => {
    expect(() => parseSeedArgs(["--bogus"])).toThrow(SeedError);
  });
});

describe("checkSeedEnvironment", () => {
  const ok = { ffmpeg: true };
  it("refuses production", () => {
    expect(() => checkSeedEnvironment({ NODE_ENV: "production" }, ok)).toThrow(/production/);
  });
  it("refuses S3", () => {
    expect(() => checkSeedEnvironment({ S3_BUCKET: "b" }, ok)).toThrow(/S3_BUCKET/);
  });
  it("refuses without ffmpeg", () => {
    expect(() => checkSeedEnvironment({}, { ffmpeg: false })).toThrow(/ffmpeg/);
  });
  it("allows a local run", () => {
    expect(() => checkSeedEnvironment({}, ok)).not.toThrow();
  });
});

describe("runSeed", () => {
  it("creates Users, Videos from completed Uploads, and queues each", async () => {
    const d = deps();
    const summary = await runSeed({ users: 2, videos: 6 }, d);

    expect(summary).toEqual({ usersCreated: 2, usersFound: 0, videosCreated: 6, videosFound: 0 });
    expect(d.queued).toHaveLength(6);
    const videos = await prisma.video.findMany({
      include: { upload: true, channel: true },
      orderBy: { createdAt: "asc" },
    });
    expect(videos.filter((v) => v.visibility === "UNLISTED")).toHaveLength(1);
    expect(videos.filter((v) => v.visibility === "PUBLIC")).toHaveLength(5);
    for (const v of videos) {
      expect(v.status).toBe("READY");
      expect(v.title && v.description).toBeTruthy();
      expect(v.title).not.toBe(v.upload!.filename);
      expect(v.upload!.completedAt).not.toBeNull();
    }
    expect(new Set(videos.map((v) => v.channelId)).size).toBe(2);
    expect(d.logs.join("\n")).toContain("demo-user-1@seed.streamsouk.local");
  });

  it("is idempotent and says nothing new was created", async () => {
    await runSeed({ users: 2, videos: 3 }, deps());
    const d = deps();
    const summary = await runSeed({ users: 2, videos: 3 }, d);

    expect(summary).toEqual({ usersCreated: 0, usersFound: 2, videosCreated: 0, videosFound: 3 });
    expect(d.stored).toEqual([]);
    expect(d.queued).toEqual([]);
    expect(d.logs.join("\n")).toContain("Nothing new was created.");
    expect(await prisma.video.count()).toBe(3);
    expect(await prisma.user.count()).toBe(2);
  });

  it("adds only the missing Videos when the count grows, keeping owners", async () => {
    await runSeed({ users: 2, videos: 2 }, deps());
    const before = await prisma.upload.findMany({ orderBy: { tusId: "asc" } });
    const d = deps();
    await runSeed({ users: 3, videos: 4 }, d);

    expect(d.stored).toEqual(["seed-demo-3", "seed-demo-4"]);
    expect(await prisma.video.count()).toBe(4);
    for (const old of before) {
      const now = await prisma.upload.findUniqueOrThrow({ where: { id: old.id } });
      expect(now.userId).toBe(old.userId);
    }
  });

  it("changes nothing when the count is lowered, and says so", async () => {
    await runSeed({ users: 1, videos: 10 }, deps());
    const d = deps();
    await runSeed({ users: 1, videos: 6 }, d);

    expect(await prisma.video.count()).toBe(10);
    expect(d.logs.join("\n")).toContain("10 seeded Videos exist, you asked for 6, nothing removed");
  });

  it("stops on a name clash with a non-demo account and writes nothing", async () => {
    await UserRepository.createWithChannel({
      email: "real@example.com", name: "Demo-User-2", nameKey: "demo-user-2", password: "x",
    });
    const d = deps();

    await expect(runSeed({ users: 3, videos: 3 }, d)).rejects.toThrow(/Demo-User-2.*not a demo User/);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.video.count()).toBe(0);
    expect(d.stored).toEqual([]);
  });

  it("marks a Video failed when queueing fails", async () => {
    const d = { ...deps(), queue: async () => { throw new Error("down"); } };
    await expect(runSeed({ users: 1, videos: 1 }, d)).rejects.toThrow(/1 Video failed/);
    expect((await prisma.video.findFirstOrThrow()).status).toBe("FAILED");
  });
});

describe("runSeed waiting", () => {
  it("reports progress and ends with all ready", async () => {
    const d = deps();
    await runSeed({ users: 1, videos: 2 }, { ...d, ...fakeClock(), sleep: async () => {
      await prisma.video.updateMany({ where: { status: "PROCESSING" }, data: { status: "READY" } });
    } });
    expect(d.logs.join("\n")).toMatch(/0\/2 ready, 2 processing, elapsed 0:00/);
    expect(d.logs.join("\n")).toContain("all ready (2/2)");
  });

  it("times out when nothing processes, then a re-run waits on the same Videos without re-queueing", async () => {
    const stuck = { ...deps(), ...fakeClock(), timeoutMs: 15_000, pollMs: 5_000 };
    await expect(runSeed({ users: 1, videos: 2 }, stuck)).rejects.toThrow(
      "2 Videos still processing. Is the worker running? Run the seed again to continue.",
    );
    expect(stuck.logs.join("\n")).toContain("elapsed 0:15");

    const d = deps();
    await runSeed({ users: 1, videos: 2 }, d);
    expect(d.queued).toEqual([]);
    expect(await prisma.video.count({ where: { status: "READY" } })).toBe(2);
  });

  it("re-queues a FAILED Video on the next run and ends ready", async () => {
    await runSeed({ users: 1, videos: 2 }, deps());
    const failed = await prisma.video.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
    await prisma.video.update({ where: { id: failed.id }, data: { status: "FAILED", processingProgress: 40 } });

    const d = deps();
    await runSeed({ users: 1, videos: 2 }, d);
    expect(d.queued).toEqual([failed.id]);
    expect(d.logs.join("\n")).toContain("was Failed, processing queued again");
    const after = await prisma.video.findUniqueOrThrow({ where: { id: failed.id } });
    expect(after.status).toBe("READY");
  });

  it("stops with a message when a Video fails while waiting", async () => {
    const d = { ...deps(), sleep: async () => void (await prisma.video.updateMany({ data: { status: "FAILED" } })) };
    await expect(runSeed({ users: 1, videos: 2 }, d)).rejects.toThrow(/2 Videos failed to process/);
  });
});

describe.skipIf(spawnSync("ffmpeg", ["-version"]).status !== 0)("storeDemoClip", () => {
  it("writes a playable clip under the tusd id", async () => {
    const { mkdtempSync, rmSync, statSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const root = mkdtempSync(path.join(tmpdir(), "seed-root-"));
    try {
      const size = await storeDemoClip("seed-demo-1", 1, root);
      expect(size).toBeGreaterThan(0);
      expect(statSync(path.join(root, "uploads", "seed-demo-1")).size).toBe(size);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
