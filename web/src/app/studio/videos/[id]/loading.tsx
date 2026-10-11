import { LoadingRegion } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the page: a title, the form on the left and the preview on the right.
export default function Loading() {
  return (
    <LoadingRegion label="Loading video details">
      <Skeleton className="mb-2 h-5 w-32" />
      <Skeleton className="mb-8 h-12 w-2/3 max-w-md" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-hidden="true">
        <div className="grid gap-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid content-start gap-3">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </LoadingRegion>
  );
}
