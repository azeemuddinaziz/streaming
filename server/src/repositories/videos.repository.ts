import type { Visibility } from "../../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export class VideoRepository {
  static async listForUser(userId: string) {
    return await prisma.video.findMany({
      where: { channel: { userId }, deletedAt: null },
      include: { upload: { select: { filename: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  static async findForWatch(videoId: string) {
    return await prisma.video.findFirst({
      where: { id: videoId, deletedAt: null },
      include: { channel: { select: { userId: true, user: { select: { name: true } } } } },
    });
  }

  static async findForProcessing(videoId: string) {
    return await prisma.video.findFirst({
      where: { id: videoId, deletedAt: null },
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
      where: { id: videoId, channel: { userId }, deletedAt: null },
      include: { upload: { select: { filename: true } } },
    });
  }

  // Writes details only if the Video still holds what the caller read, so two
  // edits made at once cannot each pass a check the other undoes. False when
  // the Video changed in between.
  static async updateDetails(
    before: { id: string; title: string | null; description: string | null; visibility: Visibility },
    data: { title?: string | null; description?: string | null; visibility?: Visibility },
  ) {
    const claimed = await prisma.video.updateMany({
      where: {
        id: before.id,
        deletedAt: null,
        title: before.title,
        description: before.description,
        visibility: before.visibility,
      },
      data,
    });
    return claimed.count === 1;
  }

  // Puts a failed Video back to processing. Only a failed Video changes, so of
  // two simultaneous retries exactly one wins.
  static async restartProcessing(videoId: string) {
    const claimed = await prisma.video.updateMany({
      where: { id: videoId, status: "FAILED", deletedAt: null },
      data: { status: "PROCESSING" },
    });
    return claimed.count === 1;
  }

  // Flags the owner's Video as deleted. False if it is not theirs, does not
  // exist or was already deleted.
  static async softDelete(videoId: string, userId: string) {
    const claimed = await prisma.video.updateMany({
      where: { id: videoId, channel: { userId }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return claimed.count === 1;
  }
}
