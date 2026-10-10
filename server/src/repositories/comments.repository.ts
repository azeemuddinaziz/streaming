import type { Prisma } from "../../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

// A Comment that has been deleted or hidden is not shown to Viewers. Later
// tickets decide who still sees it; until then every read leaves it out.
export const visibleComments = { deletedAt: null, hiddenAt: null } as const;

// A top-level Comment is listed while it is live, or, once deleted, as a
// placeholder for as long as it still has a visible Reply.
const shownTopLevel: Prisma.CommentWhereInput = {
  hiddenAt: null,
  OR: [{ deletedAt: null }, { replies: { some: visibleComments } }],
};

const withAuthor = {
  author: { select: { name: true } },
  _count: { select: { replies: { where: visibleComments } } },
} as const;

export class CommentRepository {
  // One page of a Video's top-level Comments, newest first. Asks for one extra
  // row so the caller can tell if another page follows.
  static async listTopLevel(videoId: string, skip: number, take: number) {
    return await prisma.comment.findMany({
      where: { videoId, parentId: null, ...shownTopLevel },
      include: withAuthor,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: take + 1,
    });
  }

  // All visible Replies to a top-level Comment, oldest first.
  static async listReplies(parentId: string) {
    return await prisma.comment.findMany({
      where: { parentId, ...visibleComments },
      include: withAuthor,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  // A top-level Comment whose thread can be read: live, or a placeholder that
  // still has a visible Reply.
  static async findThread(videoId: string, commentId: string) {
    return await prisma.comment.findFirst({
      where: { id: commentId, videoId, parentId: null, ...shownTopLevel },
      select: { id: true },
    });
  }

  // The author's own live Comment (editing and deleting are the author's alone).
  // `hiddenAt` is deliberately not filtered: an author still sees a hidden Comment
  // as normal and can change it (GLOSSARY, Hidden Comment).
  static async findOwn(videoId: string, commentId: string, authorId: string) {
    return await prisma.comment.findFirst({
      where: { id: commentId, videoId, authorId, deletedAt: null },
      include: withAuthor,
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

  // A visible Comment of the Video, with its own parent's visibility.
  static async findVisible(videoId: string, commentId: string) {
    return await prisma.comment.findFirst({
      where: { id: commentId, videoId, ...visibleComments },
      include: { parent: { select: { id: true, deletedAt: true, hiddenAt: true } } },
    });
  }

  static async findWithAuthor(commentId: string) {
    return await prisma.comment.findUnique({ where: { id: commentId }, include: withAuthor });
  }

  static async create(data: { videoId: string; authorId: string; parentId: string | null; body: string }) {
    return await prisma.comment.create({ data, include: withAuthor });
  }
}
