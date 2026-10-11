import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  checkApiHealth,
  deleteVideo,
  fetchStudioPage,
  getChannelPage,
  getChannelVideos,
  deleteComment,
  editComment,
  getComments,
  getHiddenComments,
  setCommentHidden,
  getReplies,
  postComment,
  reactToComment,
  reactToVideo,
  getCurrentUser,
  getPublicVideos,
  getStudioPage,
  getSubscriptions,
  getUnfinishedUploads,
  getWatchVideo,
  replaceThumbnail,
  reportView,
  retryVideo,
  signIn,
  signOut,
  setSubscription,
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

describe("getStudioPage", () => {
  const videos = [
    {
      id: "v1",
      label: "holiday.mp4",
      status: "PROCESSING",
      visibility: "PRIVATE",
      createdAt: "2026-10-07T12:00:00.000Z",
    },
  ];

  it("passes the cookie, page and status on and returns the page", async () => {
    const { baseUrl, requests } = await startRecordingApi(200, { videos, page: 2, hasMore: false, total: 25 });

    expect(await getStudioPage("token=abc", { page: 2, status: "FAILED" }, baseUrl)).toEqual({
      ok: true,
      videos,
      page: 2,
      hasMore: false,
      total: 25,
    });
    expect(requests[0]!.headers.cookie).toBe("token=abc");
    expect(requests[0]).toMatchObject({ method: "GET", url: "/api/v1/videos/mine?page=2&status=FAILED" });
  });

  it("leaves the status out when there is no filter", async () => {
    const { baseUrl, requests } = await startRecordingApi(200, { videos, page: 1, hasMore: false, total: 1 });

    await getStudioPage("token=abc", { page: 1 }, baseUrl);
    expect(requests[0]!.url).toBe("/api/v1/videos/mine?page=1");
  });

  it("returns nothing when nobody is signed in", async () => {
    const { baseUrl } = await startRecordingApi(401, { msg: "User not Authenticated." });

    expect(await getStudioPage("", { page: 1 }, baseUrl)).toEqual({ ok: false, reason: "signed-out" });
  });

  it("says the studio is unavailable, not signed out, when the API fails", async () => {
    const { baseUrl } = await startRecordingApi(500, { msg: "Something went wrong." });
    expect(await getStudioPage("token=abc", { page: 1 }, baseUrl)).toEqual({ ok: false, reason: "unavailable" });

    await new Promise((resolve) => stub!.close(resolve));
    stub = undefined;
    expect(await getStudioPage("token=abc", { page: 1 }, baseUrl)).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("fetchStudioPage", () => {
  it("asks for the page and status from the browser and returns it", async () => {
    const body = { videos: [], page: 3, hasMore: false, total: 49 };
    const { baseUrl, requests } = await startRecordingApi(200, body);

    expect(await fetchStudioPage({ page: 3, status: "PROCESSING" }, baseUrl)).toEqual({ ok: true, ...body });
    expect(requests[0]).toMatchObject({ method: "GET", url: "/api/v1/videos/mine?page=3&status=PROCESSING" });
  });

  it("tells signed out from unavailable", async () => {
    const signedOut = await startRecordingApi(401, { msg: "User not Authenticated." });
    expect(await fetchStudioPage({ page: 1 }, signedOut.baseUrl)).toEqual({ ok: false, reason: "signed-out" });

    await new Promise((resolve) => stub!.close(resolve));
    const failing = await startRecordingApi(500, { msg: "Something went wrong." });
    expect(await fetchStudioPage({ page: 1 }, failing.baseUrl)).toEqual({ ok: false, reason: "unavailable" });
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

describe("retryVideo", () => {
  it("posts to the Video's retry address with the cookie and reports success", async () => {
    let seen = "";
    stub = createServer((req, res) => {
      seen = `${req.method} ${req.url}`;
      res.writeHead(202, { "Content-Type": "application/json" });
      res.end("{}");
    });
    await new Promise<void>((resolve) => stub!.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

    expect(await retryVideo("abc", baseUrl)).toEqual({ ok: true });
    expect(seen).toBe("POST /api/v1/videos/abc/retry");
  });

  it("returns the API's message when it refuses", async () => {
    const baseUrl = await startStubApi(409);

    expect(await retryVideo("abc", baseUrl)).toEqual({ ok: false, message: "stub" });
  });
});

describe("getWatchVideo", () => {
  it("returns the Video, and sends the cookie so an owner can open a private one", async () => {
    let seen: IncomingHttpHeaders = {};
    stub = createServer((req, res) => {
      seen = req.headers;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ video: { id: "v1", status: "READY" } }));
    });
    await new Promise<void>((resolve) => stub!.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

    expect(await getWatchVideo("v1", "token=abc", baseUrl)).toEqual({
      ok: true,
      video: { id: "v1", status: "READY" },
    });
    expect(seen.cookie).toBe("token=abc");
  });

  it("tells not found apart from the API being unavailable", async () => {
    expect(await getWatchVideo("v1", "", await startStubApi(404))).toEqual({ ok: false, reason: "not-found" });
    await new Promise((resolve) => stub!.close(resolve));
    expect(await getWatchVideo("v1", "", await startStubApi(500))).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("deleteVideo", () => {
  it("sends a DELETE with the cookie and reports success or the API's message", async () => {
    let seen = "";
    stub = createServer((req, res) => {
      seen = `${req.method} ${req.url}`;
      res.writeHead(204).end();
    });
    await new Promise<void>((resolve) => stub!.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

    expect(await deleteVideo("v1", baseUrl)).toEqual({ ok: true });
    expect(seen).toBe("DELETE /api/v1/videos/v1");

    await new Promise((resolve) => stub!.close(resolve));
    expect(await deleteVideo("v1", await startStubApi(404))).toEqual({ ok: false, message: "stub" });
  });
});

describe("replaceThumbnail", () => {
  const png = () => new File([new Uint8Array([1, 2, 3])], "cover.png", { type: "image/png" });

  it("sends the image with the cookie and returns the new address", async () => {
    let seen = "";
    let type: string | undefined;
    stub = createServer((req, res) => {
      seen = `${req.method} ${req.url}`;
      type = req.headers["content-type"];
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ video: { thumbnailPath: "/api/v1/media/t/x.jpg" } }));
    });
    await new Promise<void>((resolve) => stub!.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

    expect(await replaceThumbnail("v1", png(), baseUrl)).toEqual({
      ok: true,
      thumbnailPath: "/api/v1/media/t/x.jpg",
    });
    expect(seen).toBe("PUT /api/v1/videos/v1/thumbnail");
    expect(type).toBe("image/png");
  });

  it("refuses a non-image or oversized file without calling the API, and relays the API's message", async () => {
    const text = new File(["hi"], "a.txt", { type: "text/plain" });
    expect(await replaceThumbnail("v1", text, "http://127.0.0.1:1")).toMatchObject({ ok: false, message: expect.stringMatching(/image/) });

    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    expect(await replaceThumbnail("v1", big, "http://127.0.0.1:1")).toMatchObject({ ok: false, message: expect.stringMatching(/5 MB/) });

    expect(await replaceThumbnail("v1", png(), await startStubApi(415))).toEqual({ ok: false, message: "stub" });
  });
});

describe("reportView", () => {
  it("posts to the Video's views address and reports whether the API accepted it", async () => {
    let seen = "";
    stub = createServer((req, res) => {
      seen = `${req.method} ${req.url}`;
      res.writeHead(200, { "Content-Type": "application/json" }).end("{}");
    });
    await new Promise<void>((resolve) => stub!.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

    expect(await reportView("v1", baseUrl)).toBe(true);
    expect(seen).toBe("POST /api/v1/videos/v1/views");

    await new Promise((resolve) => stub!.close(resolve));
    expect(await reportView("v1", await startStubApi(404))).toBe(false);
  });
});

describe("getChannelPage", () => {
  it("returns the Channel and its Videos, not-found for 404, unavailable otherwise", async () => {
    let seen = "";
    stub = createServer((req, res) => {
      seen = req.url!;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ channel: { name: "Ada" }, subscribers: 2, subscribed: null, videos: [] }));
    });
    await new Promise<void>((resolve) => stub!.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

    expect(await getChannelPage("Ada", "token=abc", baseUrl)).toEqual({
      ok: true,
      channel: { name: "Ada" },
      subscribers: 2,
      subscribed: null,
      videos: [],
    });
    expect(seen).toBe("/api/v1/channels/Ada");

    await new Promise((resolve) => stub!.close(resolve));
    expect(await getChannelPage("x", "", await startStubApi(404))).toEqual({ ok: false, reason: "not-found" });
    await new Promise((resolve) => stub!.close(resolve));
    expect(await getChannelPage("x", "", await startStubApi(500))).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("getChannelVideos", () => {
  it("asks for the page and returns its Videos, or not ok", async () => {
    const body = { channel: { name: "Ada" }, videos: [{ id: "v" }], page: 2, hasMore: true, subscribers: 1 };
    const { baseUrl, requests } = await startRecordingApi(200, body);

    expect(await getChannelVideos("Ada Lovelace", 2, baseUrl)).toEqual({
      ok: true,
      videos: [{ id: "v" }],
      page: 2,
      hasMore: true,
    });
    expect(requests[0]!.url).toBe("/api/v1/channels/Ada%20Lovelace?page=2");

    await new Promise((resolve) => stub!.close(resolve));
    expect(await getChannelVideos("x", 2, await startStubApi(404))).toEqual({ ok: false });
  });
});

describe("getSubscriptions", () => {
  it("passes the page and cookie on and returns the Channels", async () => {
    const body = { channels: [{ name: "Ada", subscribers: 2, subscribed: true }], page: 2, hasMore: false };
    const { baseUrl, requests } = await startRecordingApi(200, body);

    expect(await getSubscriptions(2, "token=abc", baseUrl)).toEqual({ ok: true, ...body });
    expect(requests[0]!.headers.cookie).toBe("token=abc");
    expect(requests[0]).toMatchObject({ method: "GET", url: "/api/v1/users/me/subscriptions?page=2" });
  });

  it("reports signed-out for 401 and unavailable otherwise", async () => {
    const { baseUrl } = await startRecordingApi(401, { msg: "User not Authenticated." });
    expect(await getSubscriptions(1, "", baseUrl)).toEqual({ ok: false, reason: "signed-out" });

    await new Promise((resolve) => stub!.close(resolve));
    expect(await getSubscriptions(1, "token=abc", await startStubApi(500))).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});

describe("setSubscription", () => {
  it("subscribes with PUT, ends with DELETE and returns the state", async () => {
    const seen: string[] = [];
    stub = createServer((req, res) => {
      seen.push(`${req.method} ${req.url}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ subscribed: req.method === "PUT", subscribers: 1 }));
    });
    await new Promise<void>((resolve) => stub!.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

    expect(await setSubscription("Ada Lovelace", true, baseUrl)).toEqual({
      ok: true,
      state: { subscribed: true, subscribers: 1 },
    });
    expect(await setSubscription("Ada Lovelace", false, baseUrl)).toEqual({
      ok: true,
      state: { subscribed: false, subscribers: 1 },
    });
    expect(seen).toEqual([
      "PUT /api/v1/channels/Ada%20Lovelace/subscription",
      "DELETE /api/v1/channels/Ada%20Lovelace/subscription",
    ]);
  });

  it("tells the person how long to wait when over the limit", async () => {
    stub = createServer((_req, res) => {
      res.writeHead(429, { "Content-Type": "application/json", "Retry-After": "7" });
      res.end(JSON.stringify({ msg: "too fast" }));
    });
    await new Promise<void>((resolve) => stub!.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

    const result = await setSubscription("ada", true, baseUrl);

    expect(result).toMatchObject({ ok: false });
    expect(result.ok === false && result.message).toContain("7 seconds");
  });
});

describe("getPublicVideos", () => {
  it("asks for the page and returns the Videos, or reports failure", async () => {
    let seen = "";
    stub = createServer((req, res) => {
      seen = req.url!;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ videos: [], page: 2, hasMore: false }));
    });
    await new Promise<void>((resolve) => stub!.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

    expect(await getPublicVideos(2, baseUrl)).toEqual({ ok: true, videos: [], page: 2, hasMore: false });
    expect(seen).toBe("/api/v1/videos?page=2");

    await new Promise((resolve) => stub!.close(resolve));
    expect(await getPublicVideos(1, await startStubApi(500))).toEqual({ ok: false });
  });
});

describe("Comments", () => {
  it("reads a page, reads Replies, and posts with credentials", async () => {
    const seen: string[] = [];
    let sent = "";
    stub = createServer((req, res) => {
      seen.push(`${req.method} ${req.url}`);
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => {
        sent = data;
        res.writeHead(req.method === "POST" ? 201 : 200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ comments: [], replies: [], hasMore: true, comment: { id: "c1" } }));
      });
    });
    await new Promise<void>((resolve) => stub!.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

    expect(await getComments("v1", 2, baseUrl)).toEqual({ ok: true, comments: [], hasMore: true });
    expect(await getReplies("v1", "c1", baseUrl)).toEqual({ ok: true, replies: [] });
    expect(await postComment("v1", { body: "hi", parentId: "c1" }, baseUrl)).toEqual({
      ok: true,
      comment: { id: "c1" },
    });
    expect(seen).toEqual([
      "GET /api/v1/videos/v1/comments?page=2",
      "GET /api/v1/videos/v1/comments/c1/replies",
      "POST /api/v1/videos/v1/comments",
    ]);
    expect(JSON.parse(sent)).toEqual({ body: "hi", parentId: "c1" });
  });

  it("returns the API's message, or a connection message", async () => {
    const baseUrl = await startStubApi(401);
    expect(await postComment("v1", { body: "hi" }, baseUrl)).toEqual({ ok: false, message: "stub" });
    expect(await getComments("v1", 1, baseUrl)).toEqual({ ok: false, message: "stub" });
    await new Promise((resolve) => stub!.close(resolve));
    stub = undefined;
    const gone = await getReplies("v1", "c", baseUrl);
    expect(gone.ok).toBe(false);
  });
});

describe("editing and deleting a Comment", () => {
  it("sends PATCH with the text and DELETE, and reports the API's answer", async () => {
    const seen: string[] = [];
    let sent = "";
    stub = createServer((req, res) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => {
        seen.push(`${req.method} ${req.url}`);
        sent = data;
        if (req.method === "DELETE") return res.writeHead(204).end();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ comment: { id: "c1", edited: true } }));
      });
    });
    await new Promise<void>((resolve) => stub!.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

    expect(await editComment("v1", "c1", "new words", baseUrl)).toEqual({
      ok: true,
      comment: { id: "c1", edited: true },
    });
    expect(JSON.parse(sent)).toEqual({ body: "new words" });
    expect(await deleteComment("v1", "c1", baseUrl)).toEqual({ ok: true });
    expect(seen).toEqual(["PATCH /api/v1/videos/v1/comments/c1", "DELETE /api/v1/videos/v1/comments/c1"]);

    await new Promise((resolve) => stub!.close(resolve));
    const missing = await startStubApi(404);
    expect(await editComment("v1", "c1", "x", missing)).toEqual({ ok: false, message: "stub" });
    expect(await deleteComment("v1", "c1", missing)).toEqual({ ok: false, message: "stub" });
  });
});

describe("hiding Comments", () => {
  it("posts hide and unhide and reads a page of the hidden list", async () => {
    const seen: string[] = [];
    stub = createServer((req, res) => {
      seen.push(`${req.method} ${req.url}`);
      if (req.method === "POST") return res.writeHead(204).end();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ comments: [{ id: "c1" }], hasMore: false, total: 1 }));
    });
    await new Promise<void>((resolve) => stub!.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

    expect(await setCommentHidden("v1", "c1", true, baseUrl)).toEqual({ ok: true });
    expect(await setCommentHidden("v1", "c1", false, baseUrl)).toEqual({ ok: true });
    expect(await getHiddenComments("v1", 2, baseUrl)).toEqual({
      ok: true,
      comments: [{ id: "c1" }],
      hasMore: false,
      total: 1,
    });
    expect(seen).toEqual([
      "POST /api/v1/videos/v1/comments/c1/hide",
      "POST /api/v1/videos/v1/comments/c1/unhide",
      "GET /api/v1/videos/v1/comments/hidden?page=2",
    ]);

    await new Promise((resolve) => stub!.close(resolve));
    const missing = await startStubApi(404);
    expect(await setCommentHidden("v1", "c1", true, missing)).toEqual({ ok: false, message: "stub" });
    expect(await getHiddenComments("v1", 1, missing)).toEqual({ ok: false, message: "stub" });
  });
});

describe("postComment over the rate limit", () => {
  it("tells the person how long to wait, and keeps nothing else to do", async () => {
    stub = createServer((_req, res) => {
      res.writeHead(429, { "Content-Type": "application/json", "Retry-After": "12" });
      res.end(JSON.stringify({ msg: "You are commenting too fast." }));
    });
    await new Promise<void>((resolve) => stub!.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

    const result = await postComment("v1", { body: "hi" }, baseUrl);
    expect(result).toMatchObject({ ok: false });
    expect(result.ok === false && result.message).toMatch(/12 seconds/);
  });
});

describe("reactToComment", () => {
  it("sets with PUT and removes with DELETE at the Comment's address", async () => {
    const seen: string[] = [];
    stub = createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        seen.push(`${req.method} ${req.url} ${raw}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ likes: 2, myReaction: req.method === "PUT" ? "DISLIKE" : null }));
      });
    });
    await new Promise<void>((resolve) => stub!.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

    expect(await reactToComment("v1", "c1", "DISLIKE", baseUrl)).toEqual({
      ok: true,
      state: { likes: 2, myReaction: "DISLIKE" },
    });
    await reactToComment("v1", "c1", null, baseUrl);
    expect(seen).toEqual([
      'PUT /api/v1/videos/v1/comments/c1/reaction {"kind":"DISLIKE"}',
      "DELETE /api/v1/videos/v1/comments/c1/reaction ",
    ]);
  });

  it("keeps the API's message for a refused Reaction", async () => {
    const baseUrl = await startStubApi(409);

    const result = await reactToComment("v1", "c1", "LIKE", baseUrl);

    expect(result).toEqual({ ok: false, message: "stub" });
  });
});

describe("reactToVideo", () => {
  it("sets with PUT, removes with DELETE and returns the state", async () => {
    const seen: string[] = [];
    stub = createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        seen.push(`${req.method} ${req.url} ${raw}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ likes: 1, myReaction: req.method === "PUT" ? "LIKE" : null }));
      });
    });
    await new Promise<void>((resolve) => stub!.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

    expect(await reactToVideo("v1", "LIKE", baseUrl)).toEqual({
      ok: true,
      state: { likes: 1, myReaction: "LIKE" },
    });
    expect(await reactToVideo("v1", null, baseUrl)).toEqual({
      ok: true,
      state: { likes: 1, myReaction: null },
    });
    expect(seen).toEqual([
      'PUT /api/v1/videos/v1/reaction {"kind":"LIKE"}',
      "DELETE /api/v1/videos/v1/reaction ",
    ]);
  });

  it("tells the person how long to wait when over the limit", async () => {
    stub = createServer((_req, res) => {
      res.writeHead(429, { "Content-Type": "application/json", "Retry-After": "7" });
      res.end(JSON.stringify({ msg: "too fast" }));
    });
    await new Promise<void>((resolve) => stub!.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

    const result = await reactToVideo("v1", "DISLIKE", baseUrl);
    expect(result.ok === false && result.message).toMatch(/7 seconds/);
  });
});
