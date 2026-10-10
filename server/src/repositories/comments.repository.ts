import { prisma } from "../lib/prisma.ts";

// A Comment that has been deleted or hidden is not shown to Viewers. Later
// tickets decide who still sees it; until then every read leaves it out.
export const visibleComments = { deletedAt: null, hiddenAt: null } as const;

const withAuthor = {
  author: { select: { name: true } },
  _count: { select: { replies: { where: visibleComments } } },
} as const;

export class CommentRepository {
  // One page of a Video's top-level Comments, newest first. Asks for one extra
  // row so the caller can tell if another page follows.
  static async listTopLevel(videoId: string, skip: number, take: number) {
    return await prisma.comment.findMany({
      where: { videoId, parentId: null, ...visibleComments },
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

  // A visible Comment of the Video, with its own parent's visibility.
  static async findVisible(videoId: string, commentId: string) {
    return await prisma.comment.findFirst({
      where: { id: commentId, videoId, ...visibleComments },
      include: { parent: { select: { id: true, deletedAt: true, hiddenAt: true } } },
    });
  }

  static async create(data: { videoId: string; authorId: string; parentId: string | null; body: string }) {
    return await prisma.comment.create({ data, include: withAuthor });
  }
}
