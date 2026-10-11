import { FormSkeleton, LoadingRegion } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingRegion label="Loading" className="mx-auto w-full max-w-md py-8 sm:py-16">
      <div className="rounded-lg border bg-card p-6 sm:p-8">
        <Skeleton className="h-9 w-1/2" aria-hidden="true" />
        <FormSkeleton fields={3} />
      </div>
    </LoadingRegion>
  );
}
