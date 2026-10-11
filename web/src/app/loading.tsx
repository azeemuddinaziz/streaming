import { LoadingRegion, PageTitleSkeleton, VideoGridSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading videos" className="showcase">
      <PageTitleSkeleton />
      <VideoGridSkeleton />
    </LoadingRegion>
  );
}
