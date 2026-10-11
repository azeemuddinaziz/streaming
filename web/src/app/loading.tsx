import { LoadingRegion, PageTitleSkeleton, VideoGridSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading videos">
      <PageTitleSkeleton />
      <VideoGridSkeleton />
    </LoadingRegion>
  );
}
