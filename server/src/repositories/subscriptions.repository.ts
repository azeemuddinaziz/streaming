import { prisma } from "../lib/prisma.ts";

export class SubscriptionRepository {
  // Subscribes the User to the Channel; one they already have is left alone.
  static async add(userId: string, channelId: string) {
    await prisma.subscription.upsert({
      where: { userId_channelId: { userId, channelId } },
      create: { userId, channelId },
      update: {},
    });
  }

  // Ends the User's Subscription by deleting it (ADR 0001 is not extended to it).
  static async remove(userId: string, channelId: string) {
    await prisma.subscription.deleteMany({ where: { userId, channelId } });
  }

  // Whether the User holds a Subscription to the Channel.
  static async exists(userId: string, channelId: string) {
    return (await prisma.subscription.count({ where: { userId, channelId } })) > 0;
  }

  // The number of Subscribers: the only thing about them that is ever read.
  static async count(channelId: string) {
    return await prisma.subscription.count({ where: { channelId } });
  }

  // When the User's most recent Subscriptions were made, newest first, up to
  // `take` of them, none older than `since`. Feeds the write limit.
  static async recentlyCreated(userId: string, since: Date, take: number) {
    const rows = await prisma.subscription.findMany({
      where: { userId, createdAt: { gt: since } },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
      take,
    });
    return rows.map((row) => row.createdAt);
  }
}
