import Link from "next/link";
import { getApiBaseUrl } from "@/lib/api-client";

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
    <li className="video-card">
      <Link href={`/watch/${video.id}`} className="channel-video">
        {video.thumbnailPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="thumbnail" src={`${apiUrl}${video.thumbnailPath}`} alt="" loading="lazy" />
        ) : (
          <span className="thumbnail" aria-hidden="true" />
        )}
        <strong>{video.title ?? "Untitled video"}</strong>
      </Link>
      <span className="hint">
        {channelName && (
          <>
            <Link href={`/channels/${encodeURIComponent(channelName)}`}>{channelName}</Link>
            {" · "}
          </>
        )}
        {new Date(video.createdAt).toLocaleDateString("en", { dateStyle: "medium" })}
      </span>
    </li>
  );
}
