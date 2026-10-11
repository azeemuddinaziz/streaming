import { describe, expect, it } from "vitest";
import { checkAccountName, checkEmail, checkPassword } from "./account-fields";

describe("checkAccountName", () => {
  it("accepts 3 to 30 letters, digits and single inner hyphens", () => {
    for (const name of ["abc", "My-Channel-2", "a".repeat(30)]) {
      expect(checkAccountName(name)).toBeUndefined();
    }
  });

  it("explains what is wrong", () => {
    expect(checkAccountName("")).toMatch(/enter an account name/i);
    expect(checkAccountName("ab")).toMatch(/at least 3/);
    expect(checkAccountName("a".repeat(31))).toMatch(/at most 30/);
    expect(checkAccountName("has space")).toMatch(/letters, digits and hyphens/);
    expect(checkAccountName("-abc")).toMatch(/start or end/);
    expect(checkAccountName("abc-")).toMatch(/start or end/);
    expect(checkAccountName("a--b")).toMatch(/two hyphens/);
  });
});

describe("checkEmail", () => {
  it("needs something that looks like an address", () => {
    expect(checkEmail("")).toMatch(/enter your email/i);
    expect(checkEmail("nope")).toMatch(/valid email/i);
    expect(checkEmail("a@b.c")).toBeUndefined();
  });
});

describe("checkPassword", () => {
  it("only enforces length when signing up", () => {
    expect(checkPassword("", "sign-in")).toMatch(/enter your password/i);
    expect(checkPassword("x", "sign-in")).toBeUndefined();
    expect(checkPassword("short", "sign-up")).toMatch(/at least 8/);
    expect(checkPassword("longenough", "sign-up")).toBeUndefined();
  });
});
