import { Skeleton } from "@/components/ui/skeleton";

// Shared loading pieces, each mirroring the layout it stands in for.

export function PageTitleSkeleton() {
  return <Skeleton className="mb-8 h-12 w-2/3 max-w-md" />;
}

// Mirrors VideoCard.
export function VideoCardSkeleton() {
  return (
    <li className="grid content-start gap-2" aria-hidden="true">
      <Skeleton className="aspect-video w-full" />
      <Skeleton className="h-5 w-4/5" />
      <Skeleton className="h-4 w-1/2" />
    </li>
  );
}

// The grid of VideoCards in the .channel-grid.
export function VideoGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <ul className="channel-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <VideoCardSkeleton key={i} />
      ))}
    </ul>
  );
}

// Rows such as the Studio's Videos and the Subscriptions.
export function RowListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <ul className="my-8 grid gap-3" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex items-center gap-4 rounded-lg border bg-card p-3">
          <Skeleton className="aspect-video w-32 shrink-0" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function FormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className="my-8 grid gap-5" aria-hidden="true">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="grid gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-28" />
    </div>
  );
}

// Tells assistive technology something is loading; the pieces themselves are hidden.
export function LoadingRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      {children}
    </div>
  );
}

// Mirrors a CommentItem: a name line, the text, and the action row.
export function CommentListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <LoadingRegion label="Loading comments" className="grid gap-5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="grid gap-2" aria-hidden="true">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-full max-w-prose" />
          <Skeleton className="h-4 w-2/3 max-w-sm" />
          <Skeleton className="h-8 w-40" />
        </div>
      ))}
    </LoadingRegion>
  );
}
