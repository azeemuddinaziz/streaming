import { ChannelHeaderSkeleton, LoadingRegion, VideoGridSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading channel">
      <ChannelHeaderSkeleton />
      <VideoGridSkeleton count={8} />
    </LoadingRegion>
  );
}
