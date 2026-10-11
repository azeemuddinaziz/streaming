import { LoadingRegion } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion label="Loading video" className="watch">
      <Skeleton className="aspect-video w-full" />
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-20 w-full" />
    </LoadingRegion>
  );
}
