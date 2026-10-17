import { getPublicVideos, type ShowcaseVideo } from "@/lib/api-client";

// How many Suggested videos the watch page offers.
export const SUGGESTION_LIMIT = 12;

// The listing minus the Video being watched, cut to the limit, order kept.
export function pickSuggestions<T extends { id: string }>(videos: T[], currentId: string): T[] {
  return videos.filter((video) => video.id !== currentId).slice(0, SUGGESTION_LIMIT);
}

export type SuggestedVideosResult = { ok: true; videos: ShowcaseVideo[] } | { ok: false };

// The one source of Suggested videos. For now the newest public Videos (page 1
// holds 24, enough for 12 after the current one is removed); a recommendation
// engine replaces this body, not the UI.
export async function getSuggestedVideos(currentId: string): Promise<SuggestedVideosResult> {
  const result = await getPublicVideos(1);
  if (!result.ok) return { ok: false };
  return { ok: true, videos: pickSuggestions(result.videos, currentId) };
}
