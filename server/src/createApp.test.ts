import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./createApp.ts";

describe("API", () => {
  let server: ReturnType<ReturnType<typeof createApp>["listen"]>;
  let baseUrl: string;

  beforeAll(async () => {
    server = createApp().listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.close();
  });

  it("responds to the API root", async () => {
    const response = await fetch(`${baseUrl}/api/v1/`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ msg: "Hello World!" });
  });
});
