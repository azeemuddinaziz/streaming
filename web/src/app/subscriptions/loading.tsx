import { LoadingRegion, PageTitleSkeleton, RowListSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading subscriptions">
      <PageTitleSkeleton />
      <RowListSkeleton count={6} />
    </LoadingRegion>
  );
}
