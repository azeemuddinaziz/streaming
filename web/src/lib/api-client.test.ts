import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { checkApiHealth } from "./api-client";

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
