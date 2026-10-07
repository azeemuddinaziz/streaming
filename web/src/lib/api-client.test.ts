import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  checkApiHealth,
  getCurrentUser,
  getStudioVideos,
  getUnfinishedUploads,
  signIn,
  signOut,
  signUp,
} from "./api-client";

let stub: Server | undefined;

// Starts a stand-in API that answers every request with the given status,
// or never answers when no status is given.
async function startStubApi(status?: number) {
  stub = createServer((_req, res) => {
    if (status === undefined) return;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ msg: "stub" }));
  });
  await new Promise<void>((resolve) => stub!.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;
}

afterEach(async () => {
  if (stub) await new Promise((resolve) => stub!.close(resolve));
  stub = undefined;
});

describe("checkApiHealth", () => {
  it("reports healthy when the API answers 200", async () => {
    const baseUrl = await startStubApi(200);

    expect(await checkApiHealth(baseUrl)).toEqual({ healthy: true });
  });

  it("reports unhealthy when the API answers with an error", async () => {
    const baseUrl = await startStubApi(500);

    expect(await checkApiHealth(baseUrl)).toEqual({ healthy: false });
  });

  it("reports unhealthy when the API cannot be reached", async () => {
    const baseUrl = await startStubApi(200);
    await new Promise((resolve) => stub!.close(resolve));
    stub = undefined;

    expect(await checkApiHealth(baseUrl)).toEqual({ healthy: false });
  });

  it("reports unhealthy when the API does not answer in time", async () => {
    const baseUrl = await startStubApi();

    expect(await checkApiHealth(baseUrl, { timeoutMs: 50 })).toEqual({
      healthy: false,
    });
  });
});

type SeenRequest = {
  method?: string;
  url?: string;
  headers: IncomingHttpHeaders;
  body: string;
};

// Starts a stand-in API that records what it is sent and answers with the
// given status and JSON body.
async function startRecordingApi(status: number, json?: unknown) {
  const requests: SeenRequest[] = [];
  stub = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      requests.push({ method: req.method, url: req.url, headers: req.headers, body });
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(json === undefined ? "" : JSON.stringify(json));
    });
  });
  await new Promise<void>((resolve) => stub!.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;
  return { baseUrl, requests };
}

const account = {
  user: { id: "u1", email: "ada@example.com", name: "Ada-Lovelace" },
  channel: { id: "c1", name: "Ada-Lovelace" },
};

describe("signIn", () => {
  it("sends the email and password and returns the User and Channel", async () => {
    const { baseUrl, requests } = await startRecordingApi(200, account);

    const result = await signIn(
      { email: "ada@example.com", password: "correct horse battery" },
      baseUrl,
    );

    expect(result).toEqual({ ok: true, ...account });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: "POST", url: "/api/v1/users/sign-in" });
    expect(JSON.parse(requests[0]!.body)).toEqual({
      email: "ada@example.com",
      password: "correct horse battery",
    });
  });

  it("returns the message the API gives when it refuses", async () => {
    const { baseUrl } = await startRecordingApi(401, {
      msg: "Incorrect email or password.",
    });

    expect(await signIn({ email: "a@b.co", password: "x" }, baseUrl)).toEqual({
      ok: false,
      message: "Incorrect email or password.",
    });
  });

  it("explains when the API cannot be reached", async () => {
    const { baseUrl } = await startRecordingApi(200, account);
    await new Promise((resolve) => stub!.close(resolve));
    stub = undefined;

    expect(await signIn({ email: "a@b.co", password: "x" }, baseUrl)).toEqual({
      ok: false,
      message: "Could not reach the server. Try again in a moment.",
    });
  });
});

describe("signUp", () => {
  it("sends the account name, email and password", async () => {
    const { baseUrl, requests } = await startRecordingApi(201, account);

    const result = await signUp(
      { name: "Ada-Lovelace", email: "ada@example.com", password: "correct horse battery" },
      baseUrl,
    );

    expect(result).toEqual({ ok: true, ...account });
    expect(requests[0]).toMatchObject({ method: "POST", url: "/api/v1/users/sign-up" });
  });

  it("returns the message the API gives when the name is taken", async () => {
    const { baseUrl } = await startRecordingApi(409, {
      msg: "That account name is already taken.",
    });

    expect(
      await signUp({ name: "Ada", email: "a@b.co", password: "12345678" }, baseUrl),
    ).toEqual({ ok: false, message: "That account name is already taken." });
  });
});

describe("signOut", () => {
  it("asks the API to clear the sign-in", async () => {
    const { baseUrl, requests } = await startRecordingApi(204);

    await signOut(baseUrl);

    expect(requests[0]).toMatchObject({ method: "POST", url: "/api/v1/users/sign-out" });
  });
});

describe("getCurrentUser", () => {
  it("passes the cookie on and returns who is signed in", async () => {
    const { baseUrl, requests } = await startRecordingApi(200, account);

    expect(await getCurrentUser("token=abc", baseUrl)).toEqual(account);
    expect(requests[0]!.headers.cookie).toBe("token=abc");
    expect(requests[0]).toMatchObject({ method: "GET", url: "/api/v1/users/me" });
  });

  it("returns nothing when nobody is signed in", async () => {
    const { baseUrl } = await startRecordingApi(401, { msg: "User not Authenticated." });

    expect(await getCurrentUser("", baseUrl)).toBeNull();
  });

  it("returns nothing when the API cannot be reached", async () => {
    const { baseUrl } = await startRecordingApi(200, account);
    await new Promise((resolve) => stub!.close(resolve));
    stub = undefined;

    expect(await getCurrentUser("token=abc", baseUrl)).toBeNull();
  });
});

describe("getStudioVideos", () => {
  const videos = [
    {
      id: "v1",
      label: "holiday.mp4",
      status: "PROCESSING",
      visibility: "PRIVATE",
      createdAt: "2026-10-07T12:00:00.000Z",
    },
  ];

  it("passes the cookie on and returns the person's Videos", async () => {
    const { baseUrl, requests } = await startRecordingApi(200, { videos });

    expect(await getStudioVideos("token=abc", baseUrl)).toEqual({ ok: true, items: videos });
    expect(requests[0]!.headers.cookie).toBe("token=abc");
    expect(requests[0]).toMatchObject({ method: "GET", url: "/api/v1/videos/mine" });
  });

  it("returns nothing when nobody is signed in", async () => {
    const { baseUrl } = await startRecordingApi(401, { msg: "User not Authenticated." });

    expect(await getStudioVideos("", baseUrl)).toEqual({ ok: false, reason: "signed-out" });
  });

  it("says the studio is unavailable, not signed out, when the API fails", async () => {
    const { baseUrl } = await startRecordingApi(500, { msg: "Something went wrong." });
    expect(await getStudioVideos("token=abc", baseUrl)).toEqual({ ok: false, reason: "unavailable" });

    await new Promise((resolve) => stub!.close(resolve));
    stub = undefined;
    expect(await getStudioVideos("token=abc", baseUrl)).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("getUnfinishedUploads", () => {
  it("passes the cookie on and returns the person's unfinished Uploads", async () => {
    const uploads = [{ id: "u1", filename: "holiday.mp4", size: 100, createdAt: "2026-10-07T12:00:00.000Z" }];
    const { baseUrl, requests } = await startRecordingApi(200, { uploads });

    expect(await getUnfinishedUploads("token=abc", baseUrl)).toEqual({ ok: true, items: uploads });
    expect(requests[0]!.headers.cookie).toBe("token=abc");
    expect(requests[0]).toMatchObject({ method: "GET", url: "/api/v1/uploads/unfinished" });
  });

  it("returns signed-out for a 401", async () => {
    const { baseUrl } = await startRecordingApi(401, { msg: "User not Authenticated." });

    expect(await getUnfinishedUploads("", baseUrl)).toEqual({ ok: false, reason: "signed-out" });
  });
});
