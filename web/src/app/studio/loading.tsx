import { LoadingRegion, PageTitleSkeleton, RowListSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading Studio" className="studio">
      <PageTitleSkeleton />
      <RowListSkeleton />
    </LoadingRegion>
  );
}
