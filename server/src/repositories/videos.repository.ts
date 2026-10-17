import type { VideoStatus, Visibility } from "../../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";
import { countedComments } from "./comments.repository.ts";

export class VideoRepository {
  // One page of an owner's non-deleted Videos for the studio, newest first
  // (ties by id), optionally only those in one processing status, with the
  // total that matches the same filter.
  static async listForUser(userId: string, status: VideoStatus | undefined, skip: number, take: number) {
    const where = { channel: { userId }, deletedAt: null, ...(status && { status }) };
    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        include: { upload: { select: { filename: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      prisma.video.count({ where }),
    ]);
    return { videos, total };
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
        channel: { select: { id: true, userId: true, user: { select: { name: true } } } },
        upload: { select: { filename: true } },
        _count: {
          select: { views: true, comments: { where: countedComments } },
        },
      },
    });
  }

  // The Thumbnail's storage key and what decides whether it may be shared.
  static async findForThumbnail(videoId: string) {
    return await prisma.video.findFirst({
      where: { id: videoId, deletedAt: null },
      select: { thumbnailKey: true, status: true, visibility: true },
    });
  }

  // What Comments need to know about a Video.
  static async findForComments(videoId: string) {
    return await prisma.video.findFirst({
      where: { id: videoId, deletedAt: null },
      select: {
        id: true,
        status: true,
        visibility: true,
        commentsEnabled: true,
        channel: { select: { userId: true } },
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
          processingProgress: 100,
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

  // Records progress of a Video still processing. It only ever rises, so a
  // late or repeated write cannot move the bar back.
  static async setProgress(videoId: string, percent: number) {
    await prisma.video.updateMany({
      where: {
        id: videoId,
        status: "PROCESSING",
        OR: [{ processingProgress: null }, { processingProgress: { lt: percent } }],
      },
      data: { processingProgress: percent },
    });
  }

  // True when the Video was processing and is now failed.
  static async markFailed(videoId: string) {
    const { count } = await prisma.video.updateMany({
      where: { id: videoId, status: "PROCESSING" },
      data: { status: "FAILED" },
    });
    return count > 0;
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
    before: {
      id: string;
      title: string | null;
      description: string | null;
      visibility: Visibility;
      commentsEnabled: boolean;
    },
    data: {
      title?: string | null;
      description?: string | null;
      visibility?: Visibility;
      commentsEnabled?: boolean;
    },
  ) {
    const claimed = await prisma.video.updateMany({
      where: {
        id: before.id,
        deletedAt: null,
        title: before.title,
        description: before.description,
        visibility: before.visibility,
        commentsEnabled: before.commentsEnabled,
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
      data: { status: "PROCESSING", processingProgress: null },
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
