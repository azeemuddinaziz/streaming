import request from "supertest";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { prisma } from "../../src/lib/prisma";

describe("Upload Integration", () => {
  let authCookie: string;

  beforeAll(async () => {
    // Setup a user and get a session cookie
    const credentials = { username: "uploader", password: "Password123" };
    await request(app).post("/auth/register").send(credentials);
    const loginRes = await request(app).post("/auth/login").send(credentials);
    const rawCookie = loginRes.headers["set-cookie"][0];
    authCookie = rawCookie.split(";")[0];
    console.log("CLEAN COOKIE BEING SENT:", authCookie);
  });

  afterEach(async () => {
    await prisma.upload.deleteMany();
  });

  it("should create an upload intent for an authenticated user", async () => {
    const payload = {
      fileName: "my-video.mp4",
      sizeInBytes: 5000000,
      mimeType: "video/mp4",
    };

    const res = await request(app)
      .post("/upload/intent")
      .set("Cookie", [`${authCookie}`]) // Inject the session cookie
      .send(payload);

    if (res.status === 500) {
      console.log("FULL ERROR BODY:", res.body); // This will show the AppError message
    }

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty("uploadToken");
    expect(res.body.data).toHaveProperty("videoId");

    // Verify database record
    const dbRecord = await prisma.upload.findUnique({
      where: { id: res.body.data.videoId },
    });
    expect(dbRecord?.filename).toBe(payload.fileName);
  });

  it("should block upload intent without auth", async () => {
    const res = await request(app).post("/upload/intent").send({});
    expect(res.status).toBe(401);
  });
});
