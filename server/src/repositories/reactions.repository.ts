import type { ReactionKind } from "../../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

export class ReactionRepository {
  // Sets the User's Reaction to the Video, replacing the one they had.
  static async set(userId: string, videoId: string, kind: ReactionKind) {
    await prisma.reaction.upsert({
      where: { userId_videoId: { userId, videoId } },
      create: { userId, videoId, kind },
      update: { kind },
    });
  }

  // When the User's most recent Reactions were last changed, newest first, up
  // to `take` of them, none older than `since`. Feeds the write limit.
  static async recentlyChanged(userId: string, since: Date, take: number) {
    const rows = await prisma.reaction.findMany({
      where: { userId, updatedAt: { gt: since } },
      select: { updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take,
    });
    return rows.map((row) => row.updatedAt);
  }

  // Takes the User's Reaction to the Video away, if they have one.
  static async remove(userId: string, videoId: string) {
    await prisma.reaction.deleteMany({ where: { userId, videoId } });
  }

  // How many Likes and Dislikes each of the Videos has, in one query.
  static async countsFor(videoIds: string[]) {
    const rows = await prisma.reaction.groupBy({
      by: ["videoId", "kind"],
      where: { videoId: { in: videoIds } },
      _count: { _all: true },
    });
    const counts = new Map<string, { likes: number; dislikes: number }>();
    for (const id of videoIds) counts.set(id, { likes: 0, dislikes: 0 });
    for (const row of rows) {
      counts.get(row.videoId)![row.kind === "LIKE" ? "likes" : "dislikes"] = row._count._all;
    }
    return counts;
  }

  // The kind of the User's own Reaction to the Video, or null.
  static async find(userId: string, videoId: string) {
    const reaction = await prisma.reaction.findUnique({
      where: { userId_videoId: { userId, videoId } },
      select: { kind: true },
    });
    return reaction?.kind ?? null;
  }
}
