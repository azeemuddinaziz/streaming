import Link from "next/link";
import { getApiBaseUrl } from "@/lib/api-client";
import { relativeDate } from "@/lib/relative-date";

// A Video in a grid: its Thumbnail and title link to the watch page, and the
// Channel name, when shown, links to the Channel page.
export function VideoCard({
  video,
  channelName,
}: {
  video: { id: string; title: string | null; createdAt: string; thumbnailPath: string | null };
  channelName?: string;
}) {
  // The browser reaches the API at the public address, not the server-side one.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? getApiBaseUrl();

  return (
    <li className="group grid content-start gap-2">
      <Link
        href={`/watch/${video.id}`}
        className="grid gap-2 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span className="block aspect-video overflow-hidden rounded-lg border bg-border">
          {video.thumbnailPath && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="size-full object-cover transition-transform group-hover:scale-[1.02]"
              src={`${apiUrl}${video.thumbnailPath}`}
              alt=""
              loading="lazy"
            />
          )}
        </span>
        <strong className="line-clamp-2 font-medium group-hover:text-primary group-focus-within:text-primary">
          {video.title ?? "Untitled video"}
        </strong>
      </Link>
      <span className="text-sm text-muted-foreground">
        {channelName && (
          <>
            <Link
              href={`/channels/${encodeURIComponent(channelName)}`}
              className="rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring"
            >
              {channelName}
            </Link>
            {" · "}
          </>
        )}
        <time
          dateTime={video.createdAt}
          title={new Date(video.createdAt).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}
          suppressHydrationWarning
        >
          {relativeDate(video.createdAt)}
        </time>
      </span>
    </li>
  );
}
