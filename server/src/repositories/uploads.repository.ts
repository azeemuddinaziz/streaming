import { prisma } from "../lib/prisma.ts";

export class UploadRepository {
  // tusd retries a hook it did not hear back from, so recording the same
  // Upload twice leaves one record.
  static async record(data: {
    tusId: string;
    userId: string;
    filename: string;
    size: number;
  }) {
    return await prisma.upload.upsert({
      where: { tusId: data.tusId },
      create: { ...data, size: BigInt(data.size) },
      update: {},
    });
  }

  static async findByTusId(tusId: string) {
    return await prisma.upload.findUnique({ where: { tusId } });
  }

  // Marks the Upload completed and makes its Video on the owner's Channel, once.
  // The first caller claims the Upload; a repeat or a concurrent hook finds it
  // already claimed and changes nothing.
  static async completeIntoVideo(tusId: string) {
    return await prisma.$transaction(async (tx) => {
      const claimed = await tx.upload.updateMany({
        where: { tusId, completedAt: null },
        data: { completedAt: new Date() },
      });
      if (claimed.count === 0) return undefined;

      const upload = await tx.upload.findUniqueOrThrow({ where: { tusId } });
      const channel = await tx.channel.findUniqueOrThrow({
        where: { userId: upload.userId },
      });
      const video = await tx.video.create({ data: { channelId: channel.id } });
      await tx.upload.update({
        where: { id: upload.id },
        data: { videoId: video.id },
      });
      return video;
    });
  }
}
