import { prisma } from "../lib/prisma.ts";

export class ChannelRepository {
  // A Channel is named after its User; names match regardless of case.
  static async findByName(name: string) {
    return await prisma.user.findUnique({
      where: { nameKey: name.toLowerCase() },
      select: { id: true, name: true, channel: { select: { id: true } } },
    });
  }

  // One page of what anyone may see: ready, public Videos that are not deleted,
  // newest first. Asks for one extra row so the caller can tell if another page
  // follows.
  static async listPublicVideos(channelId: string, skip: number, take: number) {
    return await prisma.video.findMany({
      where: { channelId, visibility: "PUBLIC", status: "READY", deletedAt: null },
      select: { id: true, title: true, thumbnailKey: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: take + 1,
    });
  }
}
