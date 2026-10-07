import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { removeUploadBytes } from "./tusd.ts";

let stub: Server | undefined;

async function startTusd(status: number, body = "") {
  const requests: { method?: string; url?: string; tus?: string }[] = [];
  stub = createServer((req, res) => {
    requests.push({ method: req.method, url: req.url, tus: req.headers["tus-resumable"] as string });
    res.writeHead(status).end(body);
  });
  await new Promise<void>((resolve) => stub!.listen(0, "127.0.0.1", resolve));
  return { url: `http://127.0.0.1:${(stub.address() as AddressInfo).port}/files/`, requests };
}

afterEach(async () => {
  if (stub) await new Promise((resolve) => stub!.close(resolve));
  stub = undefined;
});

describe("removeUploadBytes", () => {
  it("asks tusd to terminate the upload", async () => {
    const { url, requests } = await startTusd(204);

    await removeUploadBytes("abc+multipart1", url);

    expect(requests).toEqual([
      { method: "DELETE", url: "/files/abc%2Bmultipart1", tus: "1.0.0" },
    ]);
  });

  it("treats bytes that are already gone as removed", async () => {
    for (const status of [404, 410]) {
      const { url } = await startTusd(status, "ERR_UPLOAD_NOT_FOUND: upload not found");
      await expect(removeUploadBytes("abc", url)).resolves.toBeUndefined();
      await new Promise((resolve) => stub!.close(resolve));
      stub = undefined;
    }
  });

  it("does not mistake a wrong address for removed bytes", async () => {
    // tusd answers 200 "Welcome to tusd" on a path it does not serve, and 404 from anything else.
    for (const [status, body] of [[200, "Welcome to tusd"], [404, "404 page not found"]] as const) {
      const { url } = await startTusd(status, body);
      await expect(removeUploadBytes("abc", url)).rejects.toThrow();
      await new Promise((resolve) => stub!.close(resolve));
      stub = undefined;
    }
  });

  it("works whether or not the address ends with a slash", async () => {
    const { url, requests } = await startTusd(204);

    await removeUploadBytes("abc", url.replace(/\/$/, ""));

    expect(requests[0]!.url).toBe("/files/abc");
  });

  it("fails when tusd cannot remove them, or cannot be reached", async () => {
    const { url } = await startTusd(500);
    await expect(removeUploadBytes("abc", url)).rejects.toThrow(/500/);

    await new Promise((resolve) => stub!.close(resolve));
    stub = undefined;
    await expect(removeUploadBytes("abc", url)).rejects.toThrow();
  });
});
