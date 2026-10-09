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
          title: null,
          description: null,
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

describe("editing title, description and Visibility", () => {
  async function newVideo(owner: Awaited<ReturnType<typeof person>>, tusId = "a1") {
    await uploaded(owner, tusId, "holiday.mp4");
    return (await prisma.upload.findUniqueOrThrow({ where: { tusId } })).videoId!;
  }

  const patch = (id: string, json: unknown, headers?: Record<string, string>) =>
    api.request(`/videos/${id}`, { method: "PATCH", headers, json });
  const stored = (id: string) => prisma.video.findUniqueOrThrow({ where: { id } });

  it("saves a title and description while the Video is still processing", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await newVideo(ada);

    const response = await patch(id, { title: "  Holiday ", description: "Two weeks away" }, ada.bearer);

    expect(response.status).toBe(200);
    expect(await stored(id)).toMatchObject({
      status: "PROCESSING",
      title: "Holiday",
      description: "Two weeks away",
      visibility: "PRIVATE",
    });
  });

  it("lets a Video leave private only with both a title and a description", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await newVideo(ada);

    for (const visibility of ["UNLISTED", "PUBLIC"]) {
      expect((await patch(id, { visibility }, ada.bearer)).status).toBe(400);
    }
    await patch(id, { title: "Holiday" }, ada.bearer);
    expect((await patch(id, { visibility: "PUBLIC" }, ada.bearer)).status).toBe(400);
    expect((await patch(id, { description: "   " }, ada.bearer)).status).toBe(200);
    expect((await patch(id, { visibility: "PUBLIC" }, ada.bearer)).status).toBe(400);
    expect((await stored(id)).visibility).toBe("PRIVATE");

    const ok = await patch(id, { description: "Two weeks away", visibility: "UNLISTED" }, ada.bearer);
    expect(ok.status).toBe(200);
    expect((await stored(id)).visibility).toBe("UNLISTED");
  });

  it("does not let a non-private Video lose its title or description", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await newVideo(ada);
    await patch(id, { title: "Holiday", description: "Away", visibility: "PUBLIC" }, ada.bearer);

    expect((await patch(id, { title: "" }, ada.bearer)).status).toBe(400);
    expect((await patch(id, { title: "", visibility: "PRIVATE" }, ada.bearer)).status).toBe(200);
    expect((await stored(id)).title).toBeNull();
  });

  it("rejects values of the wrong shape", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await newVideo(ada);

    for (const body of [{ visibility: "SECRET" }, { title: 5 }, { title: "x".repeat(101) }, { description: "x".repeat(5001) }]) {
      expect((await patch(id, body, ada.bearer)).status).toBe(400);
    }
  });

  it("is owner-only: someone else's or a missing Video is not found, and a stranger is refused", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await newVideo(ada);

    expect((await patch(id, { title: "Mine now" }, grace.bearer)).status).toBe(404);
    expect((await patch("nope", { title: "x" }, ada.bearer)).status).toBe(404);
    expect((await patch(id, { title: "x" })).status).toBe(401);
    expect((await stored(id)).title).toBeNull();
  });

  it("labels the studio list with the title once there is one, not the filename", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await newVideo(ada);
    await patch(id, { title: "Holiday", description: "Away" }, ada.bearer);

    const body = await (await api.request("/videos/mine", { headers: ada.bearer })).json();

    expect(body.videos[0]).toMatchObject({ label: "Holiday", title: "Holiday", description: "Away" });
  });

  it("treats a title equal to the filename as not set", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await newVideo(ada);

    expect((await patch(id, { title: "holiday.mp4", description: "Away", visibility: "PUBLIC" }, ada.bearer)).status).toBe(400);
  });
});
