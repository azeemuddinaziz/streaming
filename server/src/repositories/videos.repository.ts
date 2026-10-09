import { prisma } from "../lib/prisma.ts";

export class VideoRepository {
  static async listForUser(userId: string) {
    return await prisma.video.findMany({
      where: { channel: { userId } },
      include: { upload: { select: { filename: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  static async findForProcessing(videoId: string) {
    return await prisma.video.findUnique({
      where: { id: videoId },
      include: { upload: true },
    });
  }

  // Marks a processing Video ready with what processing produced. Only a
  // Video still processing changes, so a repeated run cannot undo a result.
  static async markReady(
    videoId: string,
    result: {
      masterPlaylistKey: string;
      thumbnailKey: string;
      renditions: { width: number; height: number; bandwidth: number; playlistKey: string }[];
    },
  ) {
    return await prisma.$transaction(async (tx) => {
      const claimed = await tx.video.updateMany({
        where: { id: videoId, status: "PROCESSING" },
        data: {
          status: "READY",
          masterPlaylistKey: result.masterPlaylistKey,
          thumbnailKey: result.thumbnailKey,
        },
      });
      if (claimed.count === 0) return;

      await tx.rendition.deleteMany({ where: { videoId } });
      await tx.rendition.createMany({
        data: result.renditions.map((rendition) => ({ ...rendition, videoId })),
      });
    });
  }

  static async markFailed(videoId: string) {
    await prisma.video.updateMany({
      where: { id: videoId, status: "PROCESSING" },
      data: { status: "FAILED" },
    });
  }

  static async findOwned(videoId: string, userId: string) {
    return await prisma.video.findFirst({
      where: { id: videoId, channel: { userId } },
      include: { upload: { select: { filename: true } } },
    });
  }

  static async updateDetails(
    videoId: string,
    data: { title?: string | null; description?: string | null; visibility?: "PRIVATE" | "UNLISTED" | "PUBLIC" },
  ) {
    return await prisma.video.update({ where: { id: videoId }, data });
  }

  // Puts a failed Video back to processing. Only a failed Video changes, so of
  // two simultaneous retries exactly one wins.
  static async restartProcessing(videoId: string) {
    const claimed = await prisma.video.updateMany({
      where: { id: videoId, status: "FAILED" },
      data: { status: "PROCESSING" },
    });
    return claimed.count === 1;
  }
}
