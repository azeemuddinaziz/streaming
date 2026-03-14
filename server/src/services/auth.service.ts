import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env";
import { UserRepository } from "../repositories/user.repository";
import { RegisterInput } from "../schema/auth.schema";
import { AppError } from "../utils/appError";

/**
 * @service AuthService
 * @description Orchestrates authentication business logic, including password hashing,
 * credential verification, and JWT issuance.
 */
class AuthService {
  private userRepo = new UserRepository();

  /**
   * Registers a new user and persists them to the database.
   * * @param data - Validated registration credentials.
   * @returns The newly created user without the sensitive password field.
   * @throws {Error} If the username is already in use.
   */
  async register(data: RegisterInput) {
    const existing = await this.userRepo.findByUsername(data.username);
    if (existing) throw new Error("Username already taken");

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await this.userRepo.create({
      ...data,
      password: hashedPassword,
    });

    return { id: user.id, username: user.username };
  }

  /**
   * Validates credentials and generates a session token.
   * * @param data - User login credentials.
   * @returns An object containing the signed JWT and sanitized user data.
   * @throws {Error} For invalid usernames or password mismatches.
   */
  async login(data: RegisterInput) {
    const user = await this.userRepo.findByUsername(data.username);
    if (!user) throw new AppError("Invalid credentials", 401);

    const isMatch = await bcrypt.compare(data.password, user.password);
    if (!isMatch) throw new AppError("Invalid username or password", 401);

    const token = jwt.sign({ id: user.id }, ENV.JWT_SECRET!, {
      expiresIn: "1d",
    });

    return { token, user: { id: user.id, username: user.username } };
  }
}

export { AuthService };
