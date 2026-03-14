import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

describe("Auth Integration", () => {
  const credentials = { username: "tester", password: "SecurePassword123" };

  afterEach(async () => {
    // Clean up the test database
    await prisma.user.deleteMany();
  });

  it("should register and then login successfully", async () => {
    // 1. Test Registration
    const regRes = await request(app).post("/auth/register").send(credentials);

    expect(regRes.status).toBe(201);
    expect(regRes.body.data.username).toBe(credentials.username);

    // 2. Test Login
    const loginRes = await request(app).post("/auth/login").send(credentials);

    expect(loginRes.status).toBe(200);
    // Verify Cookie is set
    const cookies = loginRes.headers["set-cookie"];
    expect(cookies[0]).toContain("token=");
  });

  it("should fail login with wrong password", async () => {
    await request(app).post("/auth/register").send(credentials);

    const res = await request(app)
      .post("/auth/login")
      .send({ username: "tester", password: "wrongpassword" });

    expect(res.status).toBe(401); // Or 401 depending on your error handler
  });
});
