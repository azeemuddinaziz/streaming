import { prisma } from "../lib/prisma.ts";

export class VideoRepository {
  static async listForUser(userId: string) {
    return await prisma.video.findMany({
      where: { channel: { userId } },
      include: { upload: { select: { filename: true } } },
      orderBy: { createdAt: "desc" },
    });
  }
}
