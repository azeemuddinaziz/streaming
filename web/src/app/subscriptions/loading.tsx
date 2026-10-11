import { LoadingRegion, PageTitleSkeleton, SubscriptionRowsSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading subscriptions">
      <PageTitleSkeleton />
      <SubscriptionRowsSkeleton count={6} />
    </LoadingRegion>
  );
}
