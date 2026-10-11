import { FormSkeleton, LoadingRegion, PageTitleSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading" className="form-page">
      <PageTitleSkeleton />
      <FormSkeleton />
    </LoadingRegion>
  );
}
