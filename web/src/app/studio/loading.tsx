import { LoadingRegion, PageTitleSkeleton, RowListSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion label="Loading Studio">
      <PageTitleSkeleton />
      <div className="flex gap-2" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-full" />
        ))}
      </div>
      <RowListSkeleton count={4} />
    </LoadingRegion>
  );
}
