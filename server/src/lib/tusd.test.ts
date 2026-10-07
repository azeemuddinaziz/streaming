import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { removeUploadBytes } from "./tusd.ts";

let stub: Server | undefined;

async function startTusd(status: number) {
  const requests: { method?: string; url?: string; tus?: string }[] = [];
  stub = createServer((req, res) => {
    requests.push({ method: req.method, url: req.url, tus: req.headers["tus-resumable"] as string });
    res.writeHead(status).end();
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
      const { url } = await startTusd(status);
      await expect(removeUploadBytes("abc", url)).resolves.toBeUndefined();
      await new Promise((resolve) => stub!.close(resolve));
      stub = undefined;
    }
  });

  it("fails when tusd cannot remove them, or cannot be reached", async () => {
    const { url } = await startTusd(500);
    await expect(removeUploadBytes("abc", url)).rejects.toThrow(/500/);

    await new Promise((resolve) => stub!.close(resolve));
    stub = undefined;
    await expect(removeUploadBytes("abc", url)).rejects.toThrow();
  });
});
