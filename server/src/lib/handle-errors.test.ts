import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { HttpError } from "../errors.ts";
import { handleErrors } from "./handle-errors.ts";
import { setEmit, wideEvents, type WideEvent } from "./wide-event.ts";

let server: ReturnType<ReturnType<typeof express>["listen"]>;
let baseUrl: string;
let events: WideEvent[];

beforeAll(async () => {
  const app = express();
  app.use(wideEvents);
  app.get("/missing", () => {
    throw new HttpError(404, "Video not found.");
  });
  app.get("/crash", () => {
    throw new TypeError("boom");
  });
  app.use(handleErrors);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  events = [];
  setEmit((event) => events.push(event));
});

afterEach(() => setEmit(null));

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe("error handler", () => {
  it("records a deliberate error as expected, with no stack", async () => {
    const response = await fetch(`${baseUrl}/missing`);
    await settle();

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ msg: "Video not found." });
    expect(events).toHaveLength(1);
    expect(events[0]?.error).toEqual({
      type: "HttpError",
      message: "Video not found.",
      expected: true,
    });
  });

  it("records an unexpected error with its stack and answers 500", async () => {
    const response = await fetch(`${baseUrl}/crash`);
    await settle();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ msg: "Something went wrong." });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ status: 500 });
    expect(events[0]?.error).toMatchObject({
      type: "TypeError",
      message: "boom",
      expected: false,
      stack: expect.stringContaining("boom"),
    });
  });
});
