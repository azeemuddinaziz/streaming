"use client";

import { InfiniteList } from "@/components/InfiniteList";
import { VideoCard } from "@/components/VideoCard";
import { VideoCardSkeleton } from "@/components/skeletons";
import { getChannelVideos, type ChannelVideo } from "@/lib/api-client";
import { VIDEO_GRID_CLASS } from "@/lib/video-grid";

const NOUN = { singular: "video", plural: "videos" };

function isChannelVideo(value: unknown): value is ChannelVideo {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.createdAt === "string" &&
    (v.title === null || typeof v.title === "string") &&
    (v.thumbnailPath === null || typeof v.thumbnailPath === "string")
  );
}

const getId = (video: ChannelVideo) => video.id;
const renderItem = (video: ChannelVideo) => <VideoCard key={video.id} video={video} />;
const skeleton = Array.from({ length: 6 }, (_, i) => <VideoCardSkeleton key={`skeleton-${i}`} />);

// A Channel's grid: page 1 arrives rendered by the server, the rest from the API.
export function ChannelVideos({
  channelName,
  videos,
  hasMore,
}: {
  channelName: string;
  videos: ChannelVideo[];
  hasMore: boolean;
}) {
  return (
    <InfiniteList
      // Each Channel keeps its own pages for Back (names match regardless of case).
      listKey={`channel:${channelName.toLowerCase()}`}
      initial={{ items: videos, page: 1, hasMore }}
      getId={getId}
      isItem={isChannelVideo}
      loadPage={async (page) => {
        const result = await getChannelVideos(channelName, page);
        return result.ok ? { ok: true, items: result.videos, page: result.page, hasMore: result.hasMore } : result;
      }}
      renderItem={renderItem}
      skeleton={skeleton}
      noun={NOUN}
      label={`Videos by ${channelName}`}
      className={VIDEO_GRID_CLASS}
    />
  );
}
