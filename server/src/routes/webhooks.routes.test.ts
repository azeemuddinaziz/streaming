import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../lib/prisma.ts";
import { UploadRepository } from "../repositories/uploads.repository.ts";
import { UserRepository } from "../repositories/users.repository.ts";
import { resetDatabase, startTestApi } from "../test/helpers.ts";
import { queueVideoProcessing } from "../lib/video-queue.ts";
import { setEmit, type WideEvent } from "../lib/wide-event.ts";
import { signToken } from "../utils/jwt.ts";

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

async function signedUp(name = "Ada-Lovelace") {
  const user = await UserRepository.createWithChannel({
    email: `${name.toLowerCase()}@example.com`,
    name,
    nameKey: name.toLowerCase(),
    password: "unused",
  });
  return { user, token: await signToken(user.id) };
}

// The body tusd posts to its HTTP hook.
function hook(
  type: "pre-create" | "post-create" | "pre-finish" | "post-finish",
  { headers = {}, id = "", filename = "holiday.mp4", deferred = false } = {},
) {
  return {
    Type: type,
    Event: {
      Upload: {
        ID: id,
        Size: deferred ? 0 : 1048576,
        SizeIsDeferred: deferred,
        Offset: 0,
        MetaData: filename ? { filename } : {},
        IsPartial: false,
        IsFinal: false,
        PartialUploads: null,
        Storage: null,
      },
      HTTPRequest: {
        Method: "POST",
        URI: "/files/",
        RemoteAddr: "127.0.0.1",
        Header: headers,
      },
    },
  };
}

describe("tusd pre-create hook", () => {
  it("rejects an upload with no credentials", async () => {
    const response = await api.request("/webhooks/tusd", {
      method: "POST",
      json: hook("pre-create"),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.RejectUpload).toBe(true);
    expect(body.HTTPResponse.StatusCode).toBe(401);
  });

  it("rejects a token that is invalid, and the old placeholder credential", async () => {
    for (const authorization of ["Bearer not-a-real-token", "hello"]) {
      const response = await api.request("/webhooks/tusd", {
        method: "POST",
        json: hook("pre-create", { headers: { Authorization: [authorization] } }),
      });

      expect((await response.json()).RejectUpload).toBe(true);
    }
  });

  it("rejects a valid token whose User no longer exists", async () => {
    const token = await signToken("00000000-0000-0000-0000-000000000000");

    const response = await api.request("/webhooks/tusd", {
      method: "POST",
      json: hook("pre-create", { headers: { Authorization: [`Bearer ${token}`] } }),
    });

    expect((await response.json()).RejectUpload).toBe(true);
  });

  it("accepts a valid token sent as a Bearer header or as the sign-in cookie", async () => {
    const { token } = await signedUp();

    for (const headers of [
      { Authorization: [`Bearer ${token}`] },
      { Cookie: [`theme=dark; token=${token}`] },
    ]) {
      const response = await api.request("/webhooks/tusd", {
        method: "POST",
        json: hook("pre-create", { headers }),
      });

      expect(await response.json()).toEqual({});
    }
  });

  it("rejects an upload that carries no filename", async () => {
    const { token } = await signedUp();

    const response = await api.request("/webhooks/tusd", {
      method: "POST",
      json: hook("pre-create", {
        headers: { Authorization: [`Bearer ${token}`] },
        filename: "",
      }),
    });

    const body = await response.json();
    expect(body.RejectUpload).toBe(true);
    expect(body.HTTPResponse.StatusCode).toBe(400);
  });
});

describe("tusd pre-create hook, size", () => {
  it("rejects an upload that does not say how big it is", async () => {
    const { token } = await signedUp();

    const response = await api.request("/webhooks/tusd", {
      method: "POST",
      json: hook("pre-create", {
        headers: { Authorization: [`Bearer ${token}`] },
        deferred: true,
      }),
    });

    const body = await response.json();
    expect(body.RejectUpload).toBe(true);
    expect(body.HTTPResponse.StatusCode).toBe(400);
  });
});

describe("tusd post-create hook", () => {
  it("records the Upload with its owning User and filename", async () => {
    const { user, token } = await signedUp();

    const response = await api.request("/webhooks/tusd", {
      method: "POST",
      json: hook("post-create", {
        id: "abc123",
        headers: { Authorization: [`Bearer ${token}`] },
      }),
    });

    expect(response.status).toBe(200);
    const uploads = await prisma.upload.findMany();
    expect(uploads).toEqual([
      expect.objectContaining({
        tusId: "abc123",
        userId: user.id,
        filename: "holiday.mp4",
        size: 1048576n,
      }),
    ]);
  });

  it("records nothing without valid credentials", async () => {
    const response = await api.request("/webhooks/tusd", {
      method: "POST",
      json: hook("post-create", { id: "abc123" }),
    });

    expect(response.status).toBe(200);
    expect(await prisma.upload.count()).toBe(0);
  });

  it("records an Upload once when tusd sends the hook again", async () => {
    const { token } = await signedUp();
    const body = hook("post-create", {
      id: "abc123",
      headers: { Authorization: [`Bearer ${token}`] },
    });

    await api.request("/webhooks/tusd", { method: "POST", json: body });
    await api.request("/webhooks/tusd", { method: "POST", json: body });

    expect(await prisma.upload.count()).toBe(1);
  });
});

async function startedUpload(userId: string, tusId = "abc123") {
  return UploadRepository.record({ tusId, userId, filename: "holiday.mp4", size: 1048576 });
}

describe("tusd pre-finish hook", () => {
  it("lets the Upload's owner finish it", async () => {
    const { user, token } = await signedUp();
    await startedUpload(user.id);

    const response = await api.request("/webhooks/tusd", {
      method: "POST",
      json: hook("pre-finish", { id: "abc123", headers: { Authorization: [`Bearer ${token}`] } }),
    });

    expect(await response.json()).toEqual({});
  });

  it("rejects completion by a User who does not own the Upload", async () => {
    const owner = await signedUp("Ada-Lovelace");
    const other = await signedUp("Grace-Hopper");
    await startedUpload(owner.user.id);

    const response = await api.request("/webhooks/tusd", {
      method: "POST",
      json: hook("pre-finish", { id: "abc123", headers: { Authorization: [`Bearer ${other.token}`] } }),
    });

    const body = await response.json();
    expect(body.RejectUpload).toBe(true);
    expect(body.HTTPResponse.StatusCode).toBe(403);
  });

  it("rejects completion with no valid token, and for an Upload nobody recorded", async () => {
    const { user, token } = await signedUp();
    await startedUpload(user.id);

    const noToken = await api.request("/webhooks/tusd", {
      method: "POST",
      json: hook("pre-finish", { id: "abc123" }),
    });
    expect((await noToken.json()).HTTPResponse.StatusCode).toBe(401);

    const unknown = await api.request("/webhooks/tusd", {
      method: "POST",
      json: hook("pre-finish", { id: "nope", headers: { Authorization: [`Bearer ${token}`] } }),
    });
    expect((await unknown.json()).RejectUpload).toBe(true);
  });
});

describe("tusd post-finish hook", () => {
  // tusd sends post-finish with the headers of the request that finished the upload.
  async function finish(token?: string, tusId = "abc123") {
    return api.request("/webhooks/tusd", {
      method: "POST",
      json: hook("post-finish", {
        id: tusId,
        headers: token ? { Authorization: [`Bearer ${token}`] } : {},
      }),
    });
  }

  it("completes the Upload into one private, processing Video on the owner's Channel", async () => {
    const { user, token } = await signedUp();
    await startedUpload(user.id);

    expect((await finish(token)).status).toBe(200);

    const upload = await prisma.upload.findUniqueOrThrow({
      where: { tusId: "abc123" },
      include: { video: true },
    });
    expect(upload.completedAt).not.toBeNull();
    expect(upload.video).toEqual(
      expect.objectContaining({ status: "PROCESSING", visibility: "PRIVATE" }),
    );
    const channel = await prisma.channel.findUniqueOrThrow({ where: { userId: user.id } });
    expect(upload.video!.channelId).toBe(channel.id);
  });

  it("queues processing of the new Video, once however many times tusd sends the hook", async () => {
    const { user, token } = await signedUp();
    await startedUpload(user.id);

    await Promise.all([finish(token), finish(token)]);
    await finish(token);

    const video = await prisma.video.findFirstOrThrow();
    expect(queueVideoProcessing).toHaveBeenCalledTimes(1);
    expect(queueVideoProcessing).toHaveBeenCalledWith(video.id);
  });

  it("marks the Video failed when processing cannot be queued, rather than leaving it processing", async () => {
    vi.mocked(queueVideoProcessing).mockRejectedValueOnce(new Error("queue down"));
    const { user, token } = await signedUp();
    await startedUpload(user.id);

    expect((await finish(token)).status).toBe(200);

    expect((await prisma.video.findFirstOrThrow()).status).toBe("FAILED");
  });

  it("queues nothing for an Upload that cannot become a Video", async () => {
    const { token } = await signedUp();

    await finish(token, "nope");

    expect(queueVideoProcessing).not.toHaveBeenCalled();
  });

  it("makes exactly one Video however many times tusd sends the hook", async () => {
    const { user, token } = await signedUp();
    await startedUpload(user.id);

    await Promise.all([finish(token), finish(token), finish(token)]);
    await finish(token);

    expect(await prisma.video.count()).toBe(1);
  });

  it("makes no Video for an Upload nobody recorded", async () => {
    const { token } = await signedUp();

    expect((await finish(token, "nope")).status).toBe(200);
    expect(await prisma.video.count()).toBe(0);
  });

  // tusd still sends post-finish after pre-finish refused the request, so this
  // hook has to check the owner itself.
  it("makes no Video when someone other than the owner finished the Upload", async () => {
    const owner = await signedUp("Ada-Lovelace");
    const other = await signedUp("Grace-Hopper");
    await startedUpload(owner.user.id);

    await finish(other.token);
    await finish();

    expect(await prisma.video.count()).toBe(0);
    const upload = await prisma.upload.findUniqueOrThrow({ where: { tusId: "abc123" } });
    expect(upload.completedAt).toBeNull();
  });
});

describe("tusd hook events", () => {
  let events: WideEvent[];
  beforeEach(() => {
    events = [];
    setEmit((event) => events.push(event));
  });
  afterEach(() => setEmit(null));

  const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
  const post = async (body: unknown) => {
    const response = await api.request("/webhooks/tusd", { method: "POST", json: body });
    await settle();
    return response;
  };

  it("records a rejected hook with its hook name and rejection status, though tusd gets a 200", async () => {
    const response = await post(hook("pre-create", { id: "secret-tus-id" }));

    expect(response.status).toBe(200);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      status: 200,
      tusdHook: "pre-create",
      outcome: "rejected",
      rejectStatus: 401,
      tusdUploadFingerprint: expect.stringMatching(/^[0-9a-f]{16}$/),
    });
    expect(JSON.stringify(events[0])).not.toContain("secret-tus-id");
  });

  it("records an allowed hook", async () => {
    const { token } = await signedUp();

    await post(hook("pre-create", { headers: { Authorization: [`Bearer ${token}`] } }));

    expect(events[0]).toMatchObject({ tusdHook: "pre-create", outcome: "allowed" });
    expect(events[0]).not.toHaveProperty("rejectStatus");
  });

  it("records an unhandled hook type on the event and writes no console line", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await post({ ...hook("pre-create"), Type: "pre-teleport" });

    expect(response.status).toBe(200);
    expect(events[0]).toMatchObject({ tusdHook: "pre-teleport", outcome: "unhandled" });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
