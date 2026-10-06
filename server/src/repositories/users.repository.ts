import { prisma } from "../lib/prisma.ts";

export class UserRepository {
  static async findById(id: string) {
    return await prisma.user.findUnique({
      where: {
        id: id,
      },
    });
  }
}
