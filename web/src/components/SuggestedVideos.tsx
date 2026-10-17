import { Button } from "@/components/ui/button";
import { VideoRow } from "@/components/VideoCard";
import { getSuggestedVideos } from "@/lib/suggested-videos";

// Suggested videos beside the Video being watched. A server component, rendered
// inside <Suspense> so the player never waits for it; a failure stays inside the
// section and never reaches the watch page's error state.
export async function SuggestedVideos({ currentId }: { currentId: string }) {
  const result = await getSuggestedVideos(currentId);

  return (
    <section aria-labelledby="suggested-videos-heading" className="grid content-start gap-3">
      <h2 id="suggested-videos-heading" className="font-sans text-xl font-semibold">
        Suggested videos
      </h2>
      {!result.ok ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 text-sm">
          <p>Couldn&apos;t load suggestions.</p>
          <Button asChild variant="outline" size="sm">
            {/* A full load, so the API is asked again rather than a cached client route reused. */}
            <a href={`/watch/${currentId}`}>Try again</a>
          </Button>
        </div>
      ) : result.videos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No other videos yet.</p>
      ) : (
        <ul className="grid gap-3">
          {result.videos.map((video) => (
            <VideoRow key={video.id} video={video} channelName={video.channelName} />
          ))}
        </ul>
      )}
    </section>
  );
}
