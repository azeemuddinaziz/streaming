import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { UploadRepository } from "../repositories/uploads.repository.ts";
import { UserRepository } from "../repositories/users.repository.ts";
import { resetDatabase, startTestApi } from "../test/helpers.ts";
import { signToken } from "../utils/jwt.ts";
import { TusdService } from "../services/tusd.services.ts";

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

async function person(name: string) {
  const user = await UserRepository.createWithChannel({
    email: `${name.toLowerCase()}@example.com`,
    name,
    nameKey: name.toLowerCase(),
    password: "unused",
  });
  return { user, bearer: { Authorization: `Bearer ${await signToken(user.id)}` } };
}

async function uploaded(
  owner: Awaited<ReturnType<typeof person>>,
  tusId: string,
  filename: string,
) {
  await UploadRepository.record({ tusId, userId: owner.user.id, filename, size: 10 });
  await TusdService.postFinish({ ID: tusId } as never, {
    Header: { Authorization: [owner.bearer.Authorization] },
  } as never);
}

describe("studio list", () => {
  it("shows an owner their Videos, labelled with the filename, and no one else's", async () => {
    const ada = await person("Ada-Lovelace");
    const grace = await person("Grace-Hopper");
    await uploaded(ada, "a1", "holiday.mp4");
    await uploaded(grace, "g1", "secret.mp4");

    const response = await api.request("/videos/mine", { headers: ada.bearer });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      videos: [
        {
          id: expect.any(String),
          label: "holiday.mp4",
          status: "PROCESSING",
          visibility: "PRIVATE",
          createdAt: expect.any(String),
        },
      ],
    });
  });

  it("is empty before anything is uploaded, and refused to anyone not signed in", async () => {
    const ada = await person("Ada-Lovelace");

    const empty = await api.request("/videos/mine", { headers: ada.bearer });
    expect(await empty.json()).toEqual({ videos: [] });

    const anonymous = await api.request("/videos/mine");
    expect(anonymous.status).toBe(401);
  });
});
