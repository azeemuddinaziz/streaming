import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../lib/prisma.ts";
import { queueVideoProcessing } from "../lib/video-queue.ts";
import { UploadRepository } from "../repositories/uploads.repository.ts";
import { UserRepository } from "../repositories/users.repository.ts";
import { resetDatabase, startTestApi } from "../test/helpers.ts";
import { signToken } from "../utils/jwt.ts";
import { TusdService } from "../services/tusd.services.ts";

// The job queue is its own seam; here only what is asked of it matters.
vi.mock("../lib/video-queue.ts", () => ({
  PROCESS_VIDEO_JOB: "process-video",
  queueVideoProcessing: vi.fn(async () => {}),
}));

let api: Awaited<ReturnType<typeof startTestApi>>;

beforeAll(async () => {
  api = await startTestApi();
});

afterAll(async () => {
  await api.close();
});

beforeEach(async () => {
  vi.mocked(queueVideoProcessing).mockClear();
  await resetDatabase();
});

async function person(name: string) {
  const user = await UserRepository.createWithChannel({
    email: `${name.toLowerCase()}@example.com`,
    name,
    nameKey: name.toLowerCase(),
    password: "unused",
  });
  return { user, bearer: { Authorization: `Bearer ${await signToken(user.id)}` } };
}

async function uploaded(
  owner: Awaited<ReturnType<typeof person>>,
  tusId: string,
  filename: string,
) {
  await UploadRepository.record({ tusId, userId: owner.user.id, filename, size: 10 });
  await TusdService.postFinish({ ID: tusId } as never, {
    Header: { Authorization: [owner.bearer.Authorization] },
  } as never);
}

describe("studio list", () => {
  it("shows an owner their Videos, labelled with the filename, and no one else's", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    await uploaded(ada, "a1", "holiday.mp4");
    await uploaded(grace, "g1", "secret.mp4");

    const response = await api.request("/videos/mine", { headers: ada.bearer });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      videos: [
        {
          id: expect.any(String),
          label: "holiday.mp4",
          status: "PROCESSING",
          visibility: "PRIVATE",
          createdAt: expect.any(String),
        },
      ],
    });
  });

  it("is empty before anything is uploaded, and refused to anyone not signed in", async () => {
    const ada = await person("Ada-Lovelace");

    const empty = await api.request("/videos/mine", { headers: ada.bearer });
    expect(await empty.json()).toEqual({ videos: [] });

    const anonymous = await api.request("/videos/mine");
    expect(anonymous.status).toBe(401);
  });
});

describe("retrying failed processing", () => {
  async function failedVideo(owner: Awaited<ReturnType<typeof person>>, tusId = "a1") {
    await uploaded(owner, tusId, "holiday.mp4");
    const upload = await prisma.upload.findUniqueOrThrow({ where: { tusId } });
    await prisma.video.update({ where: { id: upload.videoId! }, data: { status: "FAILED" } });
    vi.mocked(queueVideoProcessing).mockClear();
    return upload.videoId!;
  }

  const statusOf = async (id: string) =>
    (await prisma.video.findUniqueOrThrow({ where: { id } })).status;

  it("puts the owner's failed Video back to processing and queues it", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await failedVideo(ada);

    const response = await api.request(`/videos/${id}/retry`, { method: "POST", headers: ada.bearer });

    expect(response.status).toBe(202);
    expect(await statusOf(id)).toBe("PROCESSING");
    expect(queueVideoProcessing).toHaveBeenCalledWith(id);
  });

  it("refuses a Video that is not failed, and queues nothing", async () => {
    const ada = await person("Ada-Lovelace");
    await uploaded(ada, "a1", "holiday.mp4");
    const { id } = await prisma.video.findFirstOrThrow();
    vi.mocked(queueVideoProcessing).mockClear();

    for (const status of ["PROCESSING", "READY"] as const) {
      await prisma.video.update({ where: { id }, data: { status } });
      const response = await api.request(`/videos/${id}/retry`, { method: "POST", headers: ada.bearer });
      expect(response.status).toBe(409);
      expect(await statusOf(id)).toBe(status);
    }
    expect(queueVideoProcessing).not.toHaveBeenCalled();
  });

  it("treats someone else's Video as not found, and requires sign-in", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await failedVideo(ada);

    const other = await api.request(`/videos/${id}/retry`, { method: "POST", headers: grace.bearer });
    const anonymous = await api.request(`/videos/${id}/retry`, { method: "POST" });
    const missing = await api.request("/videos/nope/retry", { method: "POST", headers: ada.bearer });

    expect([other.status, anonymous.status, missing.status]).toEqual([404, 401, 404]);
    expect(await statusOf(id)).toBe("FAILED");
    expect(queueVideoProcessing).not.toHaveBeenCalled();
  });

  it("queues once when retried twice at the same time", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await failedVideo(ada);

    const responses = await Promise.all([1, 2].map(() =>
      api.request(`/videos/${id}/retry`, { method: "POST", headers: ada.bearer })));

    expect(responses.map((r) => r.status).sort()).toEqual([202, 409]);
    expect(queueVideoProcessing).toHaveBeenCalledTimes(1);
  });

  it("returns the Video to failed when processing cannot be queued", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await failedVideo(ada);
    vi.mocked(queueVideoProcessing).mockRejectedValueOnce(new Error("queue down"));

    const response = await api.request(`/videos/${id}/retry`, { method: "POST", headers: ada.bearer });

    expect(response.status).toBe(503);
    expect(await statusOf(id)).toBe("FAILED");
  });
});
