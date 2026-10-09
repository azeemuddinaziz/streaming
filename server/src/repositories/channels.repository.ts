import { prisma } from "../lib/prisma.ts";

export class ChannelRepository {
  // A Channel is named after its User; names match regardless of case.
  static async findByName(name: string) {
    return await prisma.user.findUnique({
      where: { nameKey: name.toLowerCase() },
      select: { name: true, channel: { select: { id: true } } },
    });
  }

  // What anyone may see: ready, public Videos that are not deleted.
  static async listPublicVideos(channelId: string) {
    return await prisma.video.findMany({
      where: { channelId, visibility: "PUBLIC", status: "READY", deletedAt: null },
      select: { id: true, title: true, thumbnailKey: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  }
}
