import { AlertTriangleIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const BOX = "flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border bg-card p-8 text-center";

// A missing Video and someone else's look the same, as on the watch page.
export function EditVideoNotFound() {
  return (
    <div role="status" className={BOX}>
      <SearchXIcon aria-hidden="true" className="size-8 text-muted-foreground" />
      <p className="font-semibold">Video not found</p>
      <p className="text-sm text-muted-foreground">It may have been deleted, or it is not yours to edit.</p>
      <Button asChild variant="outline">
        <Link href="/studio">Back to your videos</Link>
      </Button>
    </div>
  );
}

export function EditVideoError({ href }: { href: string }) {
  return (
    <div role="alert" className={BOX}>
      <AlertTriangleIcon aria-hidden="true" className="size-8 text-muted-foreground" />
      <p className="font-semibold">This video could not be loaded</p>
      <p className="text-sm text-muted-foreground">Try again in a moment.</p>
      <Button asChild variant="outline">
        {/* A full load, so the API is asked again. */}
        <a href={href}>Try again</a>
      </Button>
    </div>
  );
}
