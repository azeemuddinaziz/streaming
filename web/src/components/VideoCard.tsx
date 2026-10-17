import Link from "next/link";
import { getApiBaseUrl } from "@/lib/api-client";
import { relativeDate } from "@/lib/relative-date";

type CardVideo = { id: string; title: string | null; createdAt: string; thumbnailPath: string | null };

// A Video in a grid: its Thumbnail and title link to the watch page, and the
// Channel name, when shown, links to the Channel page.
export function VideoCard({ video, channelName }: { video: CardVideo; channelName?: string }) {
  return (
    <li className="group grid content-start gap-2">
      <Link
        href={`/watch/${video.id}`}
        className="grid gap-2 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <VideoThumbnail path={video.thumbnailPath} />
        <strong className="line-clamp-2 font-medium group-hover:text-primary">
          {video.title ?? "Untitled video"}
        </strong>
      </Link>
      <VideoMeta video={video} channelName={channelName} />
    </li>
  );
}

// A Video in a narrow list, such as Suggested videos: a small Thumbnail beside
// the text. The Thumbnail repeats the title's link, so it is left out of the tab
// order and the accessibility tree.
export function VideoRow({ video, channelName }: { video: CardVideo; channelName?: string }) {
  const href = `/watch/${video.id}`;

  return (
    <li className="group flex min-w-0 gap-3">
      <Link href={href} tabIndex={-1} aria-hidden="true" className="w-36 shrink-0 sm:w-40">
        <VideoThumbnail path={video.thumbnailPath} />
      </Link>
      <div className="grid min-w-0 content-start gap-1">
        <Link
          href={href}
          className="rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <strong className="line-clamp-2 text-sm font-medium break-words group-hover:text-primary">
            {video.title ?? "Untitled video"}
          </strong>
        </Link>
        <VideoMeta video={video} channelName={channelName} />
      </div>
    </li>
  );
}

// The 16:9 frame, with the Thumbnail when there is one. Decorative: the title names the link.
function VideoThumbnail({ path }: { path: string | null }) {
  // The browser reaches the API at the public address, not the server-side one.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? getApiBaseUrl();

  return (
    <span className="block aspect-video overflow-hidden rounded-lg border bg-border">
      {path && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="size-full object-cover transition-transform group-hover:scale-[1.02]"
          src={`${apiUrl}${path}`}
          alt=""
          loading="lazy"
        />
      )}
    </span>
  );
}

// The Channel name (linked, when shown) and the relative date under a Video's title.
function VideoMeta({ video, channelName }: { video: CardVideo; channelName?: string }) {
  return (
    <span className="text-sm break-words text-muted-foreground">
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
  );
}
