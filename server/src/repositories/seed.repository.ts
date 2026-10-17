import type { Visibility } from "../../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export class SeedRepository {
  // The Users whose account name (any case) is one of `names`.
  static async findUsersByName(nameKeys: string[]) {
    return await prisma.user.findMany({ where: { nameKey: { in: nameKeys } } });
  }

  static async findUserByEmail(email: string) {
    return await prisma.user.findUnique({ where: { email } });
  }

  // Uploads recorded by the seed, found by the prefix of their tusd id.
  static async findSeededUploads(prefix: string) {
    return await prisma.upload.findMany({ where: { tusId: { startsWith: prefix } } });
  }

  // Records a finished Upload and the Video made from it, like `post-finish`
  // does, but with the details already set.
  static async createVideoFromUpload(data: {
    userId: string;
    tusId: string;
    filename: string;
    size: number;
    title: string;
    description: string;
    visibility: Visibility;
  }) {
    return await prisma.$transaction(async (tx) => {
      const channel = await tx.channel.findUniqueOrThrow({ where: { userId: data.userId } });
      const video = await tx.video.create({
        data: {
          channelId: channel.id,
          title: data.title,
          description: data.description,
          visibility: data.visibility,
        },
      });
      await tx.upload.create({
        data: {
          tusId: data.tusId,
          userId: data.userId,
          filename: data.filename,
          size: BigInt(data.size),
          completedAt: new Date(),
          videoId: video.id,
        },
      });
      return video;
    });
  }

  // Queueing failed after the Video was made: end it as `post-finish` does.
  static async markFailed(videoId: string) {
    await prisma.video.updateMany({
      where: { id: videoId, status: "PROCESSING" },
      data: { status: "FAILED" },
    });
  }
}
