import { HttpError } from "../errors.ts";
import { violatedUniqueIndex } from "../lib/prisma-errors.ts";
import { UserRepository } from "../repositories/users.repository.ts";
import { toAccount } from "../utils/account.ts";
import { signToken } from "../utils/jwt.ts";
import { hashPassword, verifyPassword } from "../utils/password.ts";

const ACCOUNT_NAME = /^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Checks the sign-up fields and returns them cleaned up (email trimmed and lowercased).
function validateSignUp(input: unknown) {
  const { email, name, password } = (input ?? {}) as Record<string, unknown>;

  if (typeof name !== "string" || name.length < 3 || name.length > 30) {
    throw new HttpError(400, "Account name must be 3 to 30 characters.");
  }
  if (!ACCOUNT_NAME.test(name)) {
    throw new HttpError(
      400,
      "Account name can only use letters, digits and hyphens, and cannot start or end with a hyphen.",
    );
  }
  if (typeof email !== "string" || !EMAIL.test(email.trim())) {
    throw new HttpError(400, "Enter a valid email address.");
  }
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  ) {
    throw new HttpError(400, "Password must be 8 to 128 characters.");
  }

  return { email: email.trim().toLowerCase(), name, password };
}

let standIn: Promise<string> | undefined;
function standInHash() {
  standIn ??= hashPassword("stand-in password for unknown emails");
  return standIn;
}

export const AuthService = {
  async signUp(input: unknown) {
    const { email, name, password } = validateSignUp(input);

    const user = await UserRepository.createWithChannel({
      email,
      name,
      nameKey: name.toLowerCase(),
      password: await hashPassword(password),
    }).catch((error) => {
      const index = violatedUniqueIndex(error);
      if (index === "User_nameKey_key") {
        throw new HttpError(409, "That account name is already taken.");
      }
      if (index === "User_email_key") {
        throw new HttpError(409, "An account with that email already exists.");
      }
      throw error;
    });

    return { token: await signToken(user.id), ...toAccount(user) };
  },

  async signIn(input: unknown) {
    const { email, password } = (input ?? {}) as Record<string, unknown>;
    const invalid = new HttpError(401, "Incorrect email or password.");

    if (typeof email !== "string" || typeof password !== "string") {
      throw invalid;
    }

    const user = await UserRepository.findByEmail(email.trim().toLowerCase());
    // Check against a stand-in hash when the email is unknown, so the reply
    // takes as long either way and does not reveal which emails have accounts.
    const passwordMatches = await verifyPassword(
      password,
      user?.password ?? (await standInHash()),
    );
    if (!user || !passwordMatches) {
      throw invalid;
    }

    return { token: await signToken(user.id), ...toAccount(user) };
  },
};
