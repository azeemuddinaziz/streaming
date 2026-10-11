import { HttpError } from "../errors.ts";
import { mediaPath } from "../lib/media-token.ts";
import { ChannelRepository } from "../repositories/channels.repository.ts";
import { SubscriptionService } from "./subscriptions.service.ts";

const CHANNEL_PAGE_SIZE = 24;

export const ChannelService = {
  // The public page of a Channel: one page of its public Videos, never private,
  // unlisted or deleted ones. A page number that is not a whole number from 1
  // is the first page.
  async page(name: string, pageParam: unknown, viewerId?: string) {
    const parsed = Number(pageParam);
    const page = Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1;

    const owner = await ChannelRepository.findByName(name);
    if (!owner?.channel) throw new HttpError(404, "Channel not found.");

    const rows = await ChannelRepository.listPublicVideos(
      owner.channel.id,
      (page - 1) * CHANNEL_PAGE_SIZE,
      CHANNEL_PAGE_SIZE,
    );
    return {
      channel: { name: owner.name },
      ...(await SubscriptionService.stateFor(owner.channel.id, viewerId)),
      videos: await Promise.all(
        rows.slice(0, CHANNEL_PAGE_SIZE).map(async (video) => ({
          id: video.id,
          title: video.title,
          createdAt: video.createdAt,
          thumbnailPath: video.thumbnailKey ? await mediaPath(video.id, video.thumbnailKey) : null,
        })),
      ),
      page,
      hasMore: rows.length > CHANNEL_PAGE_SIZE,
    };
  },
};
