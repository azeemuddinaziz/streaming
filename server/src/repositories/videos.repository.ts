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

  // One page of what anyone may see: ready, public, non-deleted Videos of every
  // Channel, newest first. Asks for one extra row so the caller can tell if
  // another page follows.
  static async listPublic(skip: number, take: number) {
    return await prisma.video.findMany({
      where: { visibility: "PUBLIC", status: "READY", deletedAt: null },
      select: {
        id: true,
        title: true,
        thumbnailKey: true,
        createdAt: true,
        channel: { select: { user: { select: { name: true } } } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: take + 1,
    });
  }

  static async findForWatch(videoId: string) {
    return await prisma.video.findFirst({
      where: { id: videoId, deletedAt: null },
      include: {
        channel: { select: { userId: true, user: { select: { name: true } } } },
        _count: { select: { views: true } },
      },
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

  // Points a ready Video at a new Thumbnail. False if the Video is gone or not ready.
  static async setThumbnail(videoId: string, thumbnailKey: string) {
    const claimed = await prisma.video.updateMany({
      where: { id: videoId, status: "READY", deletedAt: null },
      data: { thumbnailKey },
    });
    return claimed.count === 1;
  }

  // Records a View unless this Viewer already has one for the Video on `day`.
  // False when it was a repeat.
  static async addView(videoId: string, viewerKey: string, day: string) {
    const created = await prisma.view.createMany({
      data: [{ videoId, viewerKey, day }],
      skipDuplicates: true,
    });
    return created.count === 1;
  }

  static async countViews(videoId: string) {
    return await prisma.view.count({ where: { videoId, video: { deletedAt: null } } });
  }
}
