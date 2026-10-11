import { LoadingRegion } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the page: the title and the drop zone.
export default function Loading() {
  return (
    <LoadingRegion label="Loading" className="mx-auto max-w-2xl">
      <Skeleton className="mb-6 h-12 w-2/3 max-w-md" />
      <Skeleton className="h-56 w-full" />
    </LoadingRegion>
  );
}
