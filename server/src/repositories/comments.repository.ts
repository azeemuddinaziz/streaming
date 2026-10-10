import type { Prisma } from "../../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

// What counts as a Comment on a Video for anyone: not deleted, not hidden, and
// not a Reply under a hidden Comment. A deleted parent does not matter, since
// its Replies stay. Hiding a Comment hides its Replies with it, so a Reply
// carries no flag of its own for that.
export const countedComments: Prisma.CommentWhereInput = {
  deletedAt: null,
  hiddenAt: null,
  OR: [{ parentId: null }, { parent: { hiddenAt: null } }],
};

// A Reply the viewer can see: not deleted, and either showing to everyone, or
// theirs, or answering their own (hidden) Comment and not hidden on its own.
// The author of a hidden Comment is not told, so their thread looks as before.
function replyFilter(viewerId: string | undefined): Prisma.CommentWhereInput {
  return {
    deletedAt: null,
    OR: [
      { hiddenAt: null, parent: { hiddenAt: null } },
      ...(viewerId ? [{ authorId: viewerId }, { hiddenAt: null, parent: { authorId: viewerId } }] : []),
    ],
  };
}

// A top-level Comment the viewer can see: not hidden, or their own. Once
// deleted it is listed as a placeholder for as long as a Reply is visible.
function topLevelFilter(viewerId: string | undefined): Prisma.CommentWhereInput {
  return {
    AND: [
      { OR: [{ hiddenAt: null }, ...(viewerId ? [{ authorId: viewerId }] : [])] },
      { OR: [{ deletedAt: null }, { replies: { some: replyFilter(viewerId) } }] },
    ],
  };
}

function withAuthor(viewerId: string | undefined) {
  return {
    author: { select: { name: true } },
    _count: { select: { replies: { where: replyFilter(viewerId) } } },
  } as const;
}

export class CommentRepository {
  // One page of a Video's top-level Comments, newest first. Asks for one extra
  // row so the caller can tell if another page follows.
  static async listTopLevel(videoId: string, viewerId: string | undefined, skip: number, take: number) {
    return await prisma.comment.findMany({
      where: { videoId, parentId: null, ...topLevelFilter(viewerId) },
      include: withAuthor(viewerId),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: take + 1,
    });
  }

  // The Replies to a top-level Comment the viewer can see, oldest first.
  static async listReplies(parentId: string, viewerId: string | undefined) {
    return await prisma.comment.findMany({
      where: { parentId, ...replyFilter(viewerId) },
      include: withAuthor(viewerId),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  // A top-level Comment whose thread the viewer can read: live, or a placeholder
  // that still has a Reply they can see.
  static async findThread(videoId: string, commentId: string, viewerId: string | undefined) {
    return await prisma.comment.findFirst({
      where: { id: commentId, videoId, parentId: null, ...topLevelFilter(viewerId) },
      select: { id: true },
    });
  }

  // The author's own live Comment (editing and deleting are the author's alone).
  // `hiddenAt` is deliberately not filtered: an author still sees a hidden Comment
  // as normal and can change it (GLOSSARY, Hidden Comment).
  static async findOwn(videoId: string, commentId: string, authorId: string) {
    return await prisma.comment.findFirst({
      where: { id: commentId, videoId, authorId, deletedAt: null },
      include: withAuthor(authorId),
    });
  }

  // Replaces the text of the author's live Comment and marks it edited. The
  // earlier wording is not kept. False when it is no longer theirs or live.
  static async edit(commentId: string, authorId: string, body: string) {
    const claimed = await prisma.comment.updateMany({
      where: { id: commentId, authorId, deletedAt: null },
      data: { body, editedAt: new Date() },
    });
    return claimed.count === 1;
  }

  // Flags the author's live Comment as deleted; nothing is removed (ADR 0001).
  static async softDelete(commentId: string, authorId: string) {
    const claimed = await prisma.comment.updateMany({
      where: { id: commentId, authorId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return claimed.count === 1;
  }

  // A Comment of the Video that is neither deleted nor hidden, with its own
  // parent's state. This is who can be answered, whoever asks.
  static async findVisible(videoId: string, commentId: string) {
    return await prisma.comment.findFirst({
      where: { id: commentId, videoId, deletedAt: null, hiddenAt: null },
      include: { parent: { select: { id: true, deletedAt: true, hiddenAt: true } } },
    });
  }

  static async findWithAuthor(commentId: string, viewerId: string) {
    return await prisma.comment.findUnique({ where: { id: commentId }, include: withAuthor(viewerId) });
  }

  static async create(data: { videoId: string; authorId: string; parentId: string | null; body: string }) {
    return await prisma.comment.create({ data, include: withAuthor(data.authorId) });
  }

  // Creation times of the author's newest Comments and Replies since `since`,
  // newest first, on any Video. Deleted and hidden ones count: the limit is on
  // writing, not on what is still shown.
  static async recentByAuthor(authorId: string, since: Date, take: number) {
    const rows = await prisma.comment.findMany({
      where: { authorId, createdAt: { gt: since } },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
      take,
    });
    return rows.map((row) => row.createdAt);
  }

  // A live Comment of the Video, for the owner's moderation. Hidden or not.
  static async exists(videoId: string, commentId: string) {
    const found = await prisma.comment.findFirst({
      where: { id: commentId, videoId, deletedAt: null },
      select: { id: true },
    });
    return found !== null;
  }

  // Hides or un-hides a Comment. Doing it twice changes nothing. Hiding a
  // Comment does not touch its Replies' own flags, so un-hiding restores them
  // except those hidden on their own.
  static async setHidden(commentId: string, hidden: boolean) {
    await prisma.comment.updateMany({
      where: { id: commentId, deletedAt: null, hiddenAt: hidden ? null : { not: null } },
      data: { hiddenAt: hidden ? new Date() : null },
    });
  }

  // One page of the Comments and Replies the owner hid themselves, newest first.
  static async listHidden(videoId: string, ownerId: string, skip: number, take: number) {
    return await prisma.comment.findMany({
      where: { videoId, deletedAt: null, hiddenAt: { not: null } },
      include: withAuthor(ownerId),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: take + 1,
    });
  }

  static async countHidden(videoId: string) {
    return await prisma.comment.count({ where: { videoId, deletedAt: null, hiddenAt: { not: null } } });
  }
}
