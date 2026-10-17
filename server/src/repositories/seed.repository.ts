import type { Visibility } from "../../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

// Every demo User's email ends with this.
export const DEMO_EMAIL_DOMAIN = "@seed.streamsouk.local";

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
    return await prisma.upload.findMany({
      where: { tusId: { startsWith: prefix } },
      include: { video: { select: { id: true, status: true, deletedAt: true } } },
    });
  }

  // The processing status of each of these Videos that is not deleted.
  static async statusesOf(videoIds: string[]) {
    return await prisma.video.findMany({
      where: { id: { in: videoIds }, deletedAt: null },
      select: { id: true, status: true },
    });
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

  // A Comment a demo User already wrote with exactly this text in this place
  // (top level when parentId is null), whatever has happened to it since. The
  // author is not matched, so changing the number of Users cannot add duplicates.
  static async findComment(videoId: string, body: string, parentId: string | null) {
    return await prisma.comment.findFirst({
      where: { videoId, body, parentId, author: { email: { endsWith: DEMO_EMAIL_DOMAIN } } },
      select: { id: true },
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
