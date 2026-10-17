import { LoadingRegion, SuggestedVideosSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { WATCH_COLUMNS_CLASS } from "@/components/WatchLayout";
import { cn } from "@/lib/utils";

// Mirrors the watch page: player, title, Channel row with actions, description
// box, and from lg the Suggested videos column on the right.
export default function Loading() {
  return (
    <LoadingRegion
      label="Loading video"
      className={cn("grid gap-4 pb-8 lg:items-start", WATCH_COLUMNS_CLASS)}
    >
      <div className="grid min-w-0 gap-4">
        <Skeleton className="aspect-video w-full" />
        <Skeleton className="h-7 w-3/4" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-56" />
        </div>
        <Skeleton className="h-20 w-full" />
      </div>
      <div className="hidden lg:block" aria-hidden="true">
        <SuggestedVideosSkeleton count={4} />
      </div>
    </LoadingRegion>
  );
}
