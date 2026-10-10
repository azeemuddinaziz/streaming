import net, { type AddressInfo } from "node:net";
import express from "express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, startTestApi } from "../test/helpers.ts";
import { enrich, setEmit, wideEvents, type WideEvent } from "./wide-event.ts";

let api: Awaited<ReturnType<typeof startTestApi>>;
let events: WideEvent[];

beforeAll(async () => {
  api = await startTestApi();
});

afterAll(async () => {
  await api.close();
});

beforeEach(async () => {
  await resetDatabase();
  events = [];
  setEmit((event) => events.push(event));
});

afterEach(() => setEmit(null));

// The event is written when the response finishes, a moment after the client has it.
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

const person = { email: "ada@example.com", name: "Ada-Lovelace", password: "correct horse battery" };

describe("wide events", () => {
  it("emits exactly one event per request and echoes its id", async () => {
    const response = await api.request("/?q=secret", {
      headers: { "X-Request-Id": "from-the-client" },
    });
    await settle();

    expect(events).toHaveLength(1);
    const [event] = events;
    const id = response.headers.get("X-Request-Id");
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(id).not.toBe("from-the-client");
    expect(event).toMatchObject({
      requestId: id,
      service: "api",
      method: "GET",
      route: "/api/v1",
      path: "/api/v1/",
      status: 200,
      aborted: false,
    });
    expect(event.durationMs).toEqual(expect.any(Number));
    expect(event).not.toHaveProperty("userId");
    expect(event).not.toHaveProperty("channelId");
    expect(JSON.stringify(event)).not.toContain("secret");
  });

  it("records the route pattern and not the concrete id", async () => {
    await api.request("/channels/nobody");
    await settle();

    expect(events[0]).toMatchObject({
      route: "/api/v1/channels/:name",
      path: "/api/v1/channels/nobody",
      status: 404,
    });
    expect(events[0]?.error).toEqual({
      type: "HttpError",
      message: "Channel not found.",
      expected: true,
    });
  });

  it("adds the user and channel ids of a signed-in request", async () => {
    const signUp = await api.request("/users/sign-up", { method: "POST", json: person });
    const { user, channel } = await signUp.json();
    const cookie = signUp.headers.getSetCookie()[0]!.split(";")[0]!;
    events.length = 0;

    await api.request("/users/me", { headers: { Cookie: cookie } });
    await settle();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ userId: user.id, channelId: channel.id });
    expect(JSON.stringify(events[0])).not.toContain(cookie);
  });

  it("emits one event for a request the client aborts", async () => {
    const port = Number(new URL(api.baseUrl).port);
    const socket = net.connect(port, "127.0.0.1");
    await new Promise((resolve) => socket.once("connect", resolve));
    socket.write(
      "POST /api/v1/users/sign-in HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: 500\r\n\r\n{",
    );
    await settle();
    socket.destroy();
    await settle();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ method: "POST", aborted: true });
  });

  it("never records credentials", async () => {
    await api.request("/users/sign-in", {
      method: "POST",
      json: { email: "x@example.com", password: "hunter2-hunter2" },
      headers: { Authorization: "Bearer very-secret-bearer", Cookie: "token=very-secret-cookie" },
    });
    await api.request("/media/very-secret-media-token/720p/segment_000.ts");
    await api.request("/MEDIA/very-secret-media-token/720p/segment_000.ts");
    await settle();

    expect(events).toHaveLength(3);
    const logged = JSON.stringify(events);
    for (const secret of [
      "hunter2",
      "very-secret-bearer",
      "very-secret-cookie",
      "very-secret-media-token",
    ]) {
      expect(logged).not.toContain(secret);
    }
    expect(events[1]).toMatchObject({
      path: "/api/v1/media/:token/720p/segment_000.ts",
    });
  });
});

describe("enrich", () => {
  it("is harmless outside a request", () => {
    expect(() => enrich({ videoId: "v" })).not.toThrow();
  });

  it("adds fields from code that never sees the request", async () => {
    const app = express();
    app.use(wideEvents);
    app.get("/work", async (_req, res) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      await Promise.resolve().then(() => enrich({ videoId: "v1" }));
      res.json({});
    });
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;

    await fetch(`http://127.0.0.1:${port}/work`);
    await settle();
    await new Promise((resolve) => server.close(resolve));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ videoId: "v1", route: "/work", status: 200 });
  });
});
