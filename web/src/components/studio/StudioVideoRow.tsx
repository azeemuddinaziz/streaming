import { FilmIcon, PencilIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import Link from "next/link";
import { DeleteVideoButton } from "@/components/DeleteVideoButton";
import { RetryButton } from "@/components/RetryButton";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl, type StudioVideo } from "@/lib/api-client";
import { relativeDate } from "@/lib/relative-date";
import { ProcessingPhases } from "./ProcessingPhases";
import { StatusBadge } from "./StatusBadge";
import { VisibilityBadge } from "./VisibilityBadge";

const count = (n: number) => n.toLocaleString("en");

// One of the person's Videos: a card at phone width (thumbnail above), a row
// from sm. Status and Visibility are badges with a label and an icon.
export function StudioVideoRow({ video }: { video: StudioVideo }) {
  // The browser reaches the API at the public address, not the server-side one.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? getApiBaseUrl();
  const ready = video.status === "READY";

  const frame = (
    <span className="relative block aspect-video overflow-hidden rounded-md border bg-border">
      {video.thumbnailPath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="size-full object-cover" src={`${apiUrl}${video.thumbnailPath}`} alt="" loading="lazy" />
      ) : (
        <span className="grid size-full place-items-center text-muted-foreground">
          <FilmIcon aria-hidden="true" className="size-8" />
        </span>
      )}
    </span>
  );

  return (
    <li className="grid gap-x-4 gap-y-3 rounded-lg border bg-card p-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
      {ready ? (
        <Link
          href={`/watch/${video.id}`}
          aria-label={`Watch ${video.label}`}
          className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          {frame}
        </Link>
      ) : (
        frame
      )}

      <div className="grid min-w-0 content-start gap-2">
        <strong className="line-clamp-2 break-words font-medium">{video.label}</strong>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={video.status} />
          <VisibilityBadge visibility={video.visibility} />
        </div>
        {video.status === "PROCESSING" && (
          <ProcessingPhases label={video.label} progress={video.processingProgress} />
        )}
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <time
            dateTime={video.createdAt}
            title={new Date(video.createdAt).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}
            suppressHydrationWarning
          >
            {relativeDate(video.createdAt)}
          </time>
          <span className="inline-flex items-center gap-1" aria-label={`${count(video.likes)} likes`}>
            <ThumbsUpIcon aria-hidden="true" className="size-4" />
            {count(video.likes)}
          </span>
          <span className="inline-flex items-center gap-1" aria-label={`${count(video.dislikes)} dislikes`}>
            <ThumbsDownIcon aria-hidden="true" className="size-4" />
            {count(video.dislikes)}
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/studio/videos/${video.id}`}>
              <PencilIcon aria-hidden="true" />
              Edit<span className="sr-only"> details of {video.label}</span>
            </Link>
          </Button>
          {ready && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/watch/${video.id}`}>Watch</Link>
            </Button>
          )}
          {video.status === "FAILED" && <RetryButton videoId={video.id} label={video.label} />}
          <DeleteVideoButton videoId={video.id} label={video.label} />
        </div>
      </div>
    </li>
  );
}
