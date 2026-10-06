import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signToken, TOKEN_LIFETIME_SECONDS } from "../utils/jwt.ts";
import { resetDatabase, startTestApi } from "../test/helpers.ts";

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

const person = {
  email: "ada@example.com",
  name: "Ada-Lovelace",
  password: "correct horse battery",
};

describe("sign up", () => {
  it("creates a User and a Channel named after the account name, and signs them in", async () => {
    const response = await api.request("/users/sign-up", {
      method: "POST",
      json: person,
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      user: { id: expect.any(String), email: person.email, name: person.name },
      channel: { id: expect.any(String), name: person.name },
    });

    const cookie = response.headers.getSetCookie().join("\n");
    expect(cookie).toMatch(/^token=[^;]+/);
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it("rejects an account name that is taken, whatever its case", async () => {
    await api.request("/users/sign-up", { method: "POST", json: person });

    const response = await api.request("/users/sign-up", {
      method: "POST",
      json: { ...person, email: "other@example.com", name: "ada-lovelace" },
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      msg: "That account name is already taken.",
    });
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("rejects an email that already has an account, whatever its case", async () => {
    await api.request("/users/sign-up", { method: "POST", json: person });

    const response = await api.request("/users/sign-up", {
      method: "POST",
      json: { ...person, name: "Grace-Hopper", email: "ADA@example.com" },
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      msg: "An account with that email already exists.",
    });
  });

  it.each([
    ["an account name with a space", { name: "ada lovelace" }],
    ["an account name with an underscore", { name: "ada_lovelace" }],
    ["an account name that starts with a hyphen", { name: "-ada" }],
    ["an account name that is too short", { name: "ab" }],
    ["an account name that is too long", { name: "a".repeat(31) }],
    ["an email that is not an email", { email: "not-an-email" }],
    ["a password that is too short", { password: "short" }],
    ["a missing account name", { name: undefined }],
    ["a missing email", { email: undefined }],
    ["a missing password", { password: undefined }],
  ])("rejects %s", async (_label, change) => {
    const response = await api.request("/users/sign-up", {
      method: "POST",
      json: { ...person, ...change },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ msg: expect.any(String) });
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});

describe("sign in", () => {
  beforeEach(async () => {
    await api.request("/users/sign-up", { method: "POST", json: person });
  });

  it("signs in with the right email and password", async () => {
    const response = await api.request("/users/sign-in", {
      method: "POST",
      json: { email: "Ada@Example.com", password: person.password },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      user: { id: expect.any(String), email: person.email, name: person.name },
      channel: { id: expect.any(String), name: person.name },
    });
    expect(response.headers.getSetCookie().join("\n")).toMatch(
      /^token=[^;]+.*HttpOnly/is,
    );
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    const wrongPassword = await api.request("/users/sign-in", {
      method: "POST",
      json: { email: person.email, password: "not the password" },
    });
    const unknownEmail = await api.request("/users/sign-in", {
      method: "POST",
      json: { email: "nobody@example.com", password: person.password },
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(await wrongPassword.json()).toEqual(await unknownEmail.json());
    expect(wrongPassword.headers.getSetCookie()).toEqual([]);
  });
});

describe("current user", () => {
  let userId: string;
  let token: string;

  beforeEach(async () => {
    const response = await api.request("/users/sign-up", {
      method: "POST",
      json: person,
    });
    userId = (await response.json()).user.id;
    token = /^token=([^;]+)/.exec(response.headers.getSetCookie()[0]!)![1]!;
  });

  const expectedBody = () => ({
    user: { id: userId, email: person.email, name: person.name },
    channel: { id: expect.any(String), name: person.name },
  });

  it("knows who is signed in from the cookie", async () => {
    const response = await api.request("/users/me", {
      headers: { Cookie: `token=${token}` },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expectedBody());
  });

  it("knows who is signed in from an Authorization header", async () => {
    const response = await api.request("/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expectedBody());
  });

  it("rejects a request with no token", async () => {
    const response = await api.request("/users/me");

    expect(response.status).toBe(401);
  });

  it.each([
    ["a token that is not a token", "hello"],
    ["a token signed with another secret", "eyJhbGciOiJIUzI1NiJ9.e30.AAAA"],
  ])("rejects %s", async (_label, bad) => {
    const response = await api.request("/users/me", {
      headers: { Cookie: `token=${bad}` },
    });

    expect(response.status).toBe(401);
  });

  it("rejects an expired token", async () => {
    const longAgo = new Date(Date.now() - (TOKEN_LIFETIME_SECONDS + 60) * 1000);
    const expired = await signToken(userId, longAgo);

    const response = await api.request("/users/me", {
      headers: { Cookie: `token=${expired}` },
    });

    expect(response.status).toBe(401);
  });

  it("rejects a token whose User no longer exists", async () => {
    const orphan = await signToken("00000000-0000-0000-0000-000000000000");

    const response = await api.request("/users/me", {
      headers: { Cookie: `token=${orphan}` },
    });

    expect(response.status).toBe(401);
  });

  it("keeps an active person signed in by renewing an older token", async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const older = await signToken(userId, twoDaysAgo);

    const response = await api.request("/users/me", {
      headers: { Cookie: `token=${older}` },
    });

    expect(response.status).toBe(200);
    const renewed = response.headers.getSetCookie().join("\n");
    expect(renewed).toMatch(/^token=[^;]+/);
    expect(renewed).not.toContain(older);
  });

  it("does not renew a token that is still fresh", async () => {
    const response = await api.request("/users/me", {
      headers: { Cookie: `token=${token}` },
    });

    expect(response.headers.getSetCookie()).toEqual([]);
  });
});

describe("sign out", () => {
  it("clears the sign-in cookie", async () => {
    const response = await api.request("/users/sign-out", { method: "POST" });

    expect(response.status).toBe(204);
    const cookie = response.headers.getSetCookie().join("\n");
    expect(cookie).toMatch(/^token=;/);
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});

describe("calls from the web app", () => {
  it("lets the web app's origin call with credentials", async () => {
    const preflight = await api.request("/users/sign-in", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3001",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });

    expect(preflight.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3001",
    );
    expect(preflight.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
  });

  it("does not allow any other origin", async () => {
    const response = await api.request("/users/me", {
      headers: { Origin: "https://evil.example" },
    });

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});
