import { PencilIcon } from "lucide-react";
import { ThumbnailPicker } from "@/components/ThumbnailPicker";
import { VideoDetailsForm } from "@/components/VideoDetailsForm";
import type { StudioVideo } from "@/lib/api-client";

// The details editor, folded under the row until the dedicated Edit details
// page (#84) replaces it with a link. A native <details> is keyboard operable.
export function EditDetails({ video }: { video: StudioVideo }) {
  return (
    <details className="group col-span-full border-t pt-3">
      <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-md border bg-card px-3 text-sm font-medium outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <PencilIcon aria-hidden="true" className="size-3.5" />
        Edit<span className="sr-only"> details of {video.label}</span>
      </summary>
      <div className="mt-3 grid gap-3">
        {video.status === "READY" && (
          <ThumbnailPicker videoId={video.id} label={video.label} thumbnailPath={video.thumbnailPath} />
        )}
        <VideoDetailsForm video={video} />
      </div>
    </details>
  );
}
