import { LoadingRegion, PageTitleSkeleton, VideoGridSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading channel">
      <PageTitleSkeleton />
      <VideoGridSkeleton count={8} />
    </LoadingRegion>
  );
}
