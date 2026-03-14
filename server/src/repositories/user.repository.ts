import { prisma } from "../lib/prisma";
import { RegisterInput } from "../schema/auth.schema";

/**
 * @repository UserRepository
 * @description Provides direct data access to the User table via Prisma.
 * This layer is responsible for raw database operations and should contain no business logic.
 */
export class UserRepository {
  /**
   * Retrieves a user by their unique username.
   * @param {string} username - The unique identifier to search for.
   * @returns {Promise<User | null>} The user record if found, otherwise null.
   */
  async findByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } });
  }

  /**
   * Persists a new user record to the database.
   * @param {RegisterInput} data - The validated user registration data.
   * @returns {Promise<User>} The newly created user record.
   */
  async create(data: RegisterInput) {
    return prisma.user.create({ data });
  }
}
