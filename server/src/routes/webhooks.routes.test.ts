import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.ts";
import { UserRepository } from "../repositories/users.repository.ts";
import { resetDatabase, startTestApi } from "../test/helpers.ts";
import { signToken } from "../utils/jwt.ts";

let api: Awaited<ReturnType<typeof startTestApi>>;

beforeAll(async () => {
  api = await startTestApi();
});

afterAll(async () => {
  await api.close();
});

beforeEach(async () => {
  await resetDatabase();
});

async function signedUp() {
  const user = await UserRepository.createWithChannel({
    email: "ada@example.com",
    name: "Ada-Lovelace",
    nameKey: "ada-lovelace",
    password: "unused",
  });
  return { user, token: await signToken(user.id) };
}

// The body tusd posts to its HTTP hook.
function hook(
  type: "pre-create" | "post-create",
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
