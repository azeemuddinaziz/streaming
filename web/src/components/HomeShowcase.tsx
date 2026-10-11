"use client";

import { VideoCard } from "@/components/VideoCard";
import { InfiniteList } from "@/components/InfiniteList";
import { VideoCardSkeleton } from "@/components/skeletons";
import { getPublicVideos, type ShowcaseVideo } from "@/lib/api-client";

const NOUN = { singular: "video", plural: "videos" };

function isShowcaseVideo(value: unknown): value is ShowcaseVideo {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.createdAt === "string" &&
    typeof v.channelName === "string" &&
    (v.title === null || typeof v.title === "string") &&
    (v.thumbnailPath === null || typeof v.thumbnailPath === "string")
  );
}

const getId = (video: ShowcaseVideo) => video.id;

async function loadPage(page: number) {
  const result = await getPublicVideos(page);
  return result.ok ? { ok: true as const, items: result.videos, page: result.page, hasMore: result.hasMore } : result;
}

// The home page's grid: page 1 arrives rendered by the server, the rest from the API.
export function HomeShowcase({ videos, hasMore }: { videos: ShowcaseVideo[]; hasMore: boolean }) {
  return (
    <InfiniteList
      listKey="home"
      initial={{ items: videos, page: 1, hasMore }}
      getId={getId}
      isItem={isShowcaseVideo}
      loadPage={loadPage}
      renderItem={(video) => <VideoCard key={video.id} video={video} channelName={video.channelName} />}
      skeleton={Array.from({ length: 6 }, (_, i) => (
        <VideoCardSkeleton key={`skeleton-${i}`} />
      ))}
      noun={NOUN}
      label="Public videos"
      className="channel-grid"
    />
  );
}
