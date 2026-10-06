import { prisma } from "../lib/prisma.ts";

export class UserRepository {
  static async findById(id: string) {
    return await prisma.user.findUnique({
      where: {
        id: id,
      },
    });
  }

  static async findByIdWithChannel(id: string) {
    return await prisma.user.findUnique({
      where: { id },
      include: { channel: true },
    });
  }

  static async findByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email },
      include: { channel: true },
    });
  }

  // A User always has a Channel, so both are created in one transaction.
  static async createWithChannel(data: {
    email: string;
    name: string;
    nameKey: string;
    password: string;
  }) {
    return await prisma.user.create({
      data: { ...data, channel: { create: {} } },
      include: { channel: true },
    });
  }
}
