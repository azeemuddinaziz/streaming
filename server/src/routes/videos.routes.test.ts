import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDiskStorage } from "../lib/storage.ts";
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

// Thumbnails are written to a scratch folder, not the development data.
const scratch = vi.hoisted(() => ({ root: "" }));
vi.mock("../lib/storage.ts", async (original) => {
  const actual = await original<typeof import("../lib/storage.ts")>();
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  scratch.root = mkdtempSync(join(tmpdir(), "thumbs-"));
  return { ...actual, createStorage: () => actual.createDiskStorage(scratch.root) };
});

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
          thumbnailPath: null,
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

  it("rejects a body that is not an object", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await newVideo(ada);

    expect((await patch(id, ["x"], ada.bearer)).status).toBe(400);
  });

  it("treats a title equal to the filename as not set", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await newVideo(ada);

    expect((await patch(id, { title: "Holiday.MP4", description: "Away", visibility: "PUBLIC" }, ada.bearer)).status).toBe(400);
  });
});

describe("custom thumbnail", () => {
  async function readyVideo(owner: Awaited<ReturnType<typeof person>>, tusId = "t1") {
    await uploaded(owner, tusId, "clip.mp4");
    const video = (await prisma.video.findFirstOrThrow({ where: { upload: { tusId } } }));
    await prisma.video.update({
      where: { id: video.id },
      data: { status: "READY", thumbnailKey: `videos/${video.id}/thumbnail.jpg` },
    });
    return video.id;
  }
  const png = () =>
    sharp({ create: { width: 1600, height: 900, channels: 3, background: "#c33" } }).png().toBuffer();
  const put = (id: string, body: BodyInit, type: string, headers: object) =>
    api.request(`/videos/${id}/thumbnail`, {
      method: "PUT",
      body,
      headers: { "Content-Type": type, ...headers },
    });

  it("stores the image in several sizes and web formats and points the Video at it", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await readyVideo(ada);

    const response = await put(id, new Uint8Array(await png()), "image/png", ada.bearer);
    expect(response.status).toBe(200);

    const { thumbnailKey } = await prisma.video.findUniqueOrThrow({ where: { id } });
    expect(thumbnailKey).toMatch(new RegExp(`^videos/${id}/thumbnails/[\\w-]+/w640\\.jpg$`));
    const storage = createDiskStorage(scratch.root);
    const dir = thumbnailKey!.replace("w640.jpg", "");
    for (const [name, width, format] of [
      ["w320.webp", 320, "webp"], ["w640.webp", 640, "webp"], ["w1280.webp", 1280, "webp"],
      ["w320.jpg", 320, "jpeg"], ["w640.jpg", 640, "jpeg"], ["w1280.jpg", 1280, "jpeg"],
    ] as const) {
      const stream = (await storage.read(dir + name))!;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      const meta = await sharp(Buffer.concat(chunks)).metadata();
      expect(meta.format).toBe(format);
      expect(meta.width).toBe(width);
    }

    const studio = await (await api.request("/videos/mine", { headers: ada.bearer })).json();
    expect(studio.videos[0].thumbnailPath).toMatch(/^\/api\/v1\/media\/.+\/thumbnails\/[\w-]+\/w640\.jpg$/);
  });

  it("rejects a file that is not an image", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await readyVideo(ada);

    const wrongType = await put(id, "hello", "text/plain", ada.bearer);
    expect(wrongType.status).toBe(415);
    expect((await wrongType.json()).msg).toMatch(/image/i);

    const fake = await put(id, "not really a png", "image/png", ada.bearer);
    expect(fake.status).toBe(415);
  });

  it("rejects an oversized image", async () => {
    const ada = await person("Ada-Lovelace");
    const id = await readyVideo(ada);

    const response = await put(id, new Uint8Array(6 * 1024 * 1024), "image/png", ada.bearer);
    expect(response.status).toBe(413);
    expect((await response.json()).msg).toMatch(/5 MB/);
  });

  it("is for the owner only", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    const id = await readyVideo(ada);
    const body = new Uint8Array(await png());

    expect((await put(id, body, "image/png", grace.bearer)).status).toBe(404);
    expect((await put(id, body, "image/png", {})).status).toBe(401);
    expect((await put("missing", body, "image/png", ada.bearer)).status).toBe(404);
  });

  it("waits until the Video is processed", async () => {
    const ada = await person("Ada-Lovelace");
    await uploaded(ada, "p1", "clip.mp4");
    const video = await prisma.video.findFirstOrThrow({});

    const response = await put(video.id, new Uint8Array(await png()), "image/png", ada.bearer);
    expect(response.status).toBe(409);
  });
});
