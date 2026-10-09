import { HttpError } from "../errors.ts";
import { mediaPath } from "../lib/media-token.ts";
import { ChannelRepository } from "../repositories/channels.repository.ts";

export const ChannelService = {
  // The public page of a Channel: its public Videos, never private, unlisted or deleted ones.
  async page(name: string) {
    const owner = await ChannelRepository.findByName(name);
    if (!owner?.channel) throw new HttpError(404, "Channel not found.");

    const videos = await ChannelRepository.listPublicVideos(owner.channel.id);
    return {
      channel: { name: owner.name },
      videos: await Promise.all(
        videos.map(async (video) => ({
          id: video.id,
          title: video.title,
          createdAt: video.createdAt,
          thumbnailPath: video.thumbnailKey ? await mediaPath(video.id, video.thumbnailKey) : null,
        })),
      ),
    };
  },
};
