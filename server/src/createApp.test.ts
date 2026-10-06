import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./createApp.ts";

describe("API root", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createApp().listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it("responds with a greeting", async () => {
    const response = await fetch(`${baseUrl}/api/v1/`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ msg: "Hello World!" });
  });
});
