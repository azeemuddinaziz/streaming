import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.ts";
import { runJob, setWorkerEmit, type WorkerLine } from "../lib/worker-log.ts";
import { UserRepository } from "../repositories/users.repository.ts";
import { resetDatabase } from "../test/helpers.ts";
import { UploadService } from "./uploads.service.ts";

beforeEach(async () => {
  await resetDatabase();
});

const HOUR = 60 * 60 * 1000;

async function owner() {
  return UserRepository.createWithChannel({
    email: "ada@example.com",
    name: "Ada-Lovelace",
    nameKey: "ada-lovelace",
    password: "unused",
  });
}

function upload(
  userId: string,
  tusId: string,
  hoursAgo: number,
  state: { completedAt?: Date; abandonedAt?: Date } = {},
) {
  return prisma.upload.create({
    data: {
      tusId,
      userId,
      filename: `${tusId}.mp4`,
      size: 100n,
      createdAt: new Date(Date.now() - hoursAgo * HOUR),
      ...state,
    },
  });
}

describe("discarding stale Uploads", () => {
  it("removes the bytes of an Upload unfinished for over 24 hours and marks it abandoned", async () => {
    const { id } = await owner();
    await upload(id, "stale", 25);
    const removed: string[] = [];

    await UploadService.discardStale(async (tusId) => {
      removed.push(tusId);
    });

    expect(removed).toEqual(["stale"]);
    const row = await prisma.upload.findUniqueOrThrow({ where: { tusId: "stale" } });
    expect(row.abandonedAt).not.toBeNull();
  });

  it("never touches a completed Upload, however old, nor a recent unfinished one", async () => {
    const { id } = await owner();
    await upload(id, "done", 100, { completedAt: new Date() });
    await upload(id, "recent", 23);
    const removed: string[] = [];

    await UploadService.discardStale(async (tusId) => {
      removed.push(tusId);
    });

    expect(removed).toEqual([]);
    const rows = await prisma.upload.findMany();
    expect(rows.every((row) => row.abandonedAt === null)).toBe(true);
  });

  it("does not remove the bytes of an Upload twice", async () => {
    const { id } = await owner();
    await upload(id, "stale", 25);
    const removed: string[] = [];
    const remove = async (tusId: string) => {
      removed.push(tusId);
    };

    await UploadService.discardStale(remove);
    await UploadService.discardStale(remove);

    expect(removed).toEqual(["stale"]);
  });

  it("keeps going when one Upload's bytes cannot be removed, then reports the failure so it is retried", async () => {
    const { id } = await owner();
    await upload(id, "stuck", 26);
    await upload(id, "fine", 25);

    await expect(
      UploadService.discardStale(async (tusId) => {
        if (tusId === "stuck") throw new Error("storage down");
      }),
    ).rejects.toThrow(/1 of 2 stale uploads: /);

    const stuck = await prisma.upload.findUniqueOrThrow({ where: { tusId: "stuck" } });
    const fine = await prisma.upload.findUniqueOrThrow({ where: { tusId: "fine" } });
    expect(stuck.abandonedAt).toBeNull();
    expect(fine.abandonedAt).not.toBeNull();
  });

  it("wins against an Upload that finishes while its bytes are being removed", async () => {
    const { id } = await owner();
    await upload(id, "racing", 25);
    const { UploadRepository } = await import("../repositories/uploads.repository.ts");

    await UploadService.discardStale(async (tusId) => {
      // tusd's post-finish arrives after the cleanup has picked the Upload.
      await UploadRepository.completeIntoVideo(tusId);
    });

    expect(await prisma.video.count()).toBe(0);
    const row = await prisma.upload.findUniqueOrThrow({ where: { tusId: "racing" } });
    expect(row.abandonedAt).not.toBeNull();
    expect(row.completedAt).toBeNull();
  });

  it("cannot be completed into a Video once it has been abandoned", async () => {
    const { id } = await owner();
    await upload(id, "stale", 25);
    await UploadService.discardStale(async () => {});
    const { UploadRepository } = await import("../repositories/uploads.repository.ts");

    await UploadRepository.completeIntoVideo("stale");

    expect(await prisma.video.count()).toBe(0);
  });
});

describe("the worker's line for discarding", () => {
  let lines: WorkerLine[];
  const attempt = { job: "discard-stale-uploads", jobId: "job-1", attempt: 1, final: false };

  beforeEach(() => {
    lines = [];
    setWorkerEmit((line) => lines.push(line));
  });

  afterEach(() => setWorkerEmit(null));

  it("says how many stale Uploads it found, discarded and could not, without their tusd ids", async () => {
    const { id } = await owner();
    await upload(id, "stuck-tus-id", 26);
    await upload(id, "fine-tus-id", 25);
    await upload(id, "recent-tus-id", 2);

    await expect(
      runJob(attempt, () =>
        UploadService.discardStale(async (tusId) => {
          if (tusId === "stuck-tus-id") throw new Error(`tusd answered 500 when removing upload ${tusId}.`);
        }).then(() => undefined),
      ),
    ).rejects.toThrow();

    expect(lines.find((l) => l.event === "uploads.discarded")).toMatchObject({ found: 2, discarded: 1, failed: 1 });
    expect(JSON.stringify(lines)).not.toMatch(/tus-id/);
  });

  it("writes the line when there is nothing to discard", async () => {
    await runJob(attempt, () => UploadService.discardStale(async () => {}).then(() => undefined));

    expect(lines.find((l) => l.event === "uploads.discarded")).toMatchObject({ found: 0, discarded: 0, failed: 0 });
  });
});

