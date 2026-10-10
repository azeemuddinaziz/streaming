import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../lib/prisma.ts";
import { queueVideoProcessing } from "../lib/video-queue.ts";
import { setEmit, type WideEvent } from "../lib/wide-event.ts";
import { UploadRepository } from "../repositories/uploads.repository.ts";
import { UserRepository } from "../repositories/users.repository.ts";
import { resetDatabase, startTestApi } from "../test/helpers.ts";
import { signToken } from "../utils/jwt.ts";

vi.mock("../lib/video-queue.ts", async (original) => ({
  ...(await original<typeof import("../lib/video-queue.ts")>()),
  queueVideoProcessing: vi.fn(async () => {}),
}));

let api: Awaited<ReturnType<typeof startTestApi>>;
let events: WideEvent[];

beforeAll(async () => {
  api = await startTestApi();
});

afterAll(async () => {
  await api.close();
});

beforeEach(async () => {
  vi.mocked(queueVideoProcessing).mockReset();
  vi.mocked(queueVideoProcessing).mockResolvedValue(undefined);
  await resetDatabase();
  events = [];
  setEmit((event) => events.push(event));
});

afterEach(() => setEmit(null));

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

async function signedUp() {
  const user = await UserRepository.createWithChannel({
    email: "ada@example.com",
    name: "Ada-Lovelace",
    nameKey: "ada-lovelace",
    password: "unused",
  });
  return { user, bearer: { Authorization: `Bearer ${await signToken(user.id)}` } };
}

// tusd's post-finish hook, sent over HTTP like the real upload server does.
async function finishUpload(owner: Awaited<ReturnType<typeof signedUp>>, tusId = "abc123") {
  await UploadRepository.record({ tusId, userId: owner.user.id, filename: "holiday.mp4", size: 2048 });
  await api.request("/webhooks/tusd", {
    method: "POST",
    json: {
      Type: "post-finish",
      Event: {
        Upload: { ID: tusId, Size: 2048, SizeIsDeferred: false, Offset: 2048, MetaData: { filename: "holiday.mp4" } },
        HTTPRequest: { Method: "PATCH", URI: "/files/", RemoteAddr: "127.0.0.1", Header: { Authorization: [owner.bearer.Authorization] } },
      },
    },
  });
  await settle();
  return prisma.upload.findUniqueOrThrow({ where: { tusId }, include: { video: true } });
}

const last = () => events[events.length - 1]!;

describe("Video and Upload context on events", () => {
  it("puts the Upload and Video ids on the event of a finished Upload", async () => {
    const ada = await signedUp();

    const upload = await finishUpload(ada);

    expect(last()).toMatchObject({
      route: "/api/v1/webhooks/tusd",
      videoId: upload.videoId,
      uploadId: upload.id,
      uploadSize: 2048,
      videoAction: "create",
    });
  });

  it("records a failure to queue processing on the event, with no console output", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(queueVideoProcessing).mockRejectedValueOnce(new TypeError("queue down"));
    const ada = await signedUp();

    await finishUpload(ada);

    expect(last()).toMatchObject({
      queueError: { type: "TypeError" },
      statusFrom: "PROCESSING",
      statusTo: "FAILED",
    });
    expect(JSON.stringify(last())).not.toContain("queue down");
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("records the Video id and the visibility change of an update", async () => {
    const ada = await signedUp();
    const { videoId } = await finishUpload(ada);

    await api.request(`/videos/${videoId}`, {
      method: "PATCH",
      headers: ada.bearer,
      json: { title: "Holiday", description: "Two weeks", visibility: "PUBLIC" },
    });
    await settle();

    expect(last()).toMatchObject({
      route: "/api/v1/videos/:id",
      status: 200,
      videoId,
      videoAction: "update",
      visibilityFrom: "PRIVATE",
      visibilityTo: "PUBLIC",
      titleChanged: true,
      descriptionChanged: true,
    });
    expect(JSON.stringify(last())).not.toContain("Two weeks");
  });

  it("records the Video id of a delete", async () => {
    const ada = await signedUp();
    const { videoId } = await finishUpload(ada);

    const response = await api.request(`/videos/${videoId}`, { method: "DELETE", headers: ada.bearer });
    await settle();

    expect(response.status).toBe(204);
    expect(last()).toMatchObject({ status: 204, videoId, videoAction: "delete" });
  });

  it("records the status change of a retry, and a failure to queue it", async () => {
    const ada = await signedUp();
    const { videoId } = await finishUpload(ada);
    await prisma.video.update({ where: { id: videoId! }, data: { status: "FAILED" } });

    await api.request(`/videos/${videoId}/retry`, { method: "POST", headers: ada.bearer });
    await settle();
    expect(last()).toMatchObject({
      status: 202,
      videoId,
      videoAction: "retry",
      statusFrom: "FAILED",
      statusTo: "PROCESSING",
    });

    await prisma.video.update({ where: { id: videoId! }, data: { status: "FAILED" } });
    vi.mocked(queueVideoProcessing).mockRejectedValueOnce(new Error("queue down"));
    await api.request(`/videos/${videoId}/retry`, { method: "POST", headers: ada.bearer });
    await settle();
    expect(last()).toMatchObject({
      status: 503,
      videoId,
      statusTo: "FAILED",
      queueError: { type: "Error" },
      error: { expected: true },
    });
  });
});
