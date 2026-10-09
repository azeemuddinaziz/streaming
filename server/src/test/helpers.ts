import type { AddressInfo } from "node:net";
import { createApp } from "../createApp.ts";
import { prisma } from "../lib/prisma.ts";

// Starts the API on a free local port and returns a small HTTP client for it.
export async function startTestApi() {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;

  return {
    request(path: string, init: RequestInit & { json?: unknown } = {}) {
      const { json, headers, ...rest } = init;
      return fetch(`${baseUrl}${path}`, {
        ...rest,
        headers: {
          ...(json === undefined ? {} : { "Content-Type": "application/json" }),
          ...headers,
        },
        body: json === undefined ? rest.body : JSON.stringify(json),
      });
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

// Empties the test database. Child tables first.
export async function resetDatabase() {
  await prisma.view.deleteMany();
  await prisma.rendition.deleteMany();
  await prisma.upload.deleteMany();
  await prisma.video.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.user.deleteMany();
}
