import { UploadIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { UnfinishedUpload } from "@/lib/api-client";

// A short, unpaged prompt above the list: these uploads stopped part way and
// can be resumed by choosing the same file again.
export function UnfinishedUploads({ uploads }: { uploads: UnfinishedUpload[] }) {
  return (
    <section aria-labelledby="unfinished-heading" className="mb-8 grid gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="unfinished-heading" className="font-sans text-lg font-semibold">
          Unfinished uploads
        </h2>
        <Button asChild size="sm">
          <Link href="/upload">
            <UploadIcon aria-hidden="true" />
            Resume
          </Link>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        These stopped part way. Choose the same file again to carry on where it stopped. They are discarded 24
        hours after they started.
      </p>
      <ul className="grid gap-1">
        {uploads.map((upload) => (
          <li key={upload.id} className="break-words text-sm font-medium">
            {upload.filename}
          </li>
        ))}
      </ul>
    </section>
  );
}
