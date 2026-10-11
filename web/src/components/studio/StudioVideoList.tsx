"use client";

import type { StudioVideo } from "@/lib/api-client";
import { StudioVideoRow } from "./StudioVideoRow";
import { useStudioPolling } from "./useStudioPolling";

// The page's rows, kept current while any Video is processing (see
// `useStudioPolling`). The live region is polite and only ever holds a
// finished Video's name, never a percentage.
export function StudioVideoList({
  videos,
  page,
  status,
}: {
  videos: StudioVideo[];
  page: number;
  status: StudioVideo["status"] | undefined;
}) {
  const { videos: live, announcement } = useStudioPolling(videos, { page, status });

  return (
    <>
      <ul className="mt-4 grid gap-3">
        {live.map((video) => (
          <StudioVideoRow key={video.id} video={video} />
        ))}
      </ul>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  );
}
