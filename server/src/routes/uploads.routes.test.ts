import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.ts";
import { UserRepository } from "../repositories/users.repository.ts";
import { resetDatabase, startTestApi } from "../test/helpers.ts";
import { signToken } from "../utils/jwt.ts";

let api: Awaited<ReturnType<typeof startTestApi>>;

beforeAll(async () => {
  api = await startTestApi();
});

afterAll(async () => {
  await api.close();
});

beforeEach(async () => {
  await resetDatabase();
});

const HOUR = 60 * 60 * 1000;

async function person(name: string) {
  const user = await UserRepository.createWithChannel({
    email: `${name.toLowerCase()}@example.com`,
    name,
    nameKey: name.toLowerCase(),
    password: "unused",
  });
  return { user, bearer: { Authorization: `Bearer ${await signToken(user.id)}` } };
}

function upload(
  userId: string,
  tusId: string,
  extra: { hoursAgo?: number; completedAt?: Date; abandonedAt?: Date } = {},
) {
  const { hoursAgo = 1, ...state } = extra;
  return prisma.upload.create({
    data: {
      tusId,
      userId,
      filename: `${tusId}.mp4`,
      size: 100n,
      createdAt: new Date(Date.now() - hoursAgo * HOUR),
      ...state,
    },
  });
}

describe("unfinished uploads", () => {
  it("lists an owner's unfinished Uploads by filename, and no one else's", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    await upload(ada.user.id, "mine");
    await upload(grace.user.id, "theirs");

    const response = await api.request("/uploads/unfinished", { headers: ada.bearer });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      uploads: [
        {
          id: expect.any(String),
          filename: "mine.mp4",
          size: 100,
          createdAt: expect.any(String),
        },
      ],
    });
  });

  it("leaves out completed Uploads, abandoned ones, and ones older than 24 hours", async () => {
    const ada = await person("Ada-Lovelace");
    await upload(ada.user.id, "fresh", { hoursAgo: 23 });
    await upload(ada.user.id, "done", { completedAt: new Date() });
    await upload(ada.user.id, "gone", { hoursAgo: 30, abandonedAt: new Date() });
    await upload(ada.user.id, "stale-but-not-yet-cleaned", { hoursAgo: 25 });

    const response = await api.request("/uploads/unfinished", { headers: ada.bearer });

    const { uploads } = await response.json();
    expect(uploads.map((u: { filename: string }) => u.filename)).toEqual(["fresh.mp4"]);
  });

  it("is refused to anyone not signed in", async () => {
    expect((await api.request("/uploads/unfinished")).status).toBe(401);
  });
});
