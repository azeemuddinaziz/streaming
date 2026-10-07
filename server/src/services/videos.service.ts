import { VideoRepository } from "../repositories/videos.repository.ts";

export const VideoService = {
  // A Video is labelled with its Upload's filename until it has a title.
  async listStudio(userId: string) {
    const videos = await VideoRepository.listForUser(userId);

    return videos.map((video) => ({
      id: video.id,
      label: video.upload?.filename ?? "Untitled",
      status: video.status,
      visibility: video.visibility,
      createdAt: video.createdAt,
    }));
  },
};
