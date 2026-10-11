import { LoadingRegion } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the watch page: player, title, Channel row with actions, description box.
export default function Loading() {
  return (
    <LoadingRegion label="Loading video" className="grid gap-4">
      <Skeleton className="aspect-video w-full" />
      <Skeleton className="h-7 w-3/4" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-56" />
      </div>
      <Skeleton className="h-20 w-full" />
    </LoadingRegion>
  );
}
