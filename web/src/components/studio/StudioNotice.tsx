import { AlertTriangleIcon, FilmIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL } from "./StatusBadge";
import type { StudioStatus } from "@/lib/studio-list";

const BOX = "flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border bg-card p-8 text-center";

// Nothing uploaded yet, or nothing matching the filter.
export function StudioEmpty({ status }: { status: StudioStatus | undefined }) {
  if (status) {
    return (
      <div role="status" className={BOX}>
        <FilmIcon aria-hidden="true" className="size-8 text-muted-foreground" />
        <p className="font-semibold">No {STATUS_LABEL[status].toLowerCase()} videos</p>
        <Button asChild variant="outline">
          <Link href="/studio">Show all videos</Link>
        </Button>
      </div>
    );
  }
  return (
    <div role="status" className={BOX}>
      <FilmIcon aria-hidden="true" className="size-8 text-muted-foreground" />
      <p className="font-semibold">Nothing here yet</p>
      <p className="text-sm text-muted-foreground">Upload a video to get started.</p>
      <Button asChild>
        <Link href="/upload">Upload a video</Link>
      </Button>
    </div>
  );
}

// The API did not answer for the list.
export function StudioError({ href }: { href: string }) {
  return (
    <div role="alert" className={BOX}>
      <AlertTriangleIcon aria-hidden="true" className="size-8 text-muted-foreground" />
      <p className="font-semibold">Your videos could not be loaded</p>
      <p className="text-sm text-muted-foreground">Try again in a moment.</p>
      <Button asChild variant="outline">
        {/* A full load, so the API is asked again. */}
        <a href={href}>Try again</a>
      </Button>
    </div>
  );
}
