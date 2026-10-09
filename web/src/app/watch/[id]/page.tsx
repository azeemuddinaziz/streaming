import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { cache } from "react";
import { VideoPlayer } from "@/components/VideoPlayer";
import { getApiBaseUrl, getWatchVideo } from "@/lib/api-client";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

// The page and its metadata share one request to the API.
const load = cache(async (id: string) => {
  const cookie = (await cookies()).toString();
  return getWatchVideo(id, cookie);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await load((await params).id);
  if (!result.ok || result.video.status !== "READY") {
    return { title: "Watch · StreamSouk" };
  }
  const { title, description } = result.video;
  return {
    title: `${title ?? "Untitled video"} · StreamSouk`,
    description: description ?? undefined,
    openGraph: { title: title ?? undefined, description: description ?? undefined, type: "video.other" },
  };
}

export default async function WatchPage({ params }: Props) {
  const result = await load((await params).id);

  if (!result.ok) {
    return result.reason === "not-found" ? (
      <section className="watch">
        <p className="eyebrow">Watch</p>
        <h1>
          Video <em>not found</em>
        </h1>
        <p>This video does not exist, or it is private.</p>
        <p>
          <Link href="/">Back to StreamSouk</Link>
        </p>
      </section>
    ) : (
      <section className="watch">
        <p role="alert">This video could not be loaded right now. Try again in a moment.</p>
      </section>
    );
  }

  const { video } = result;
  const title = video.title ?? "Untitled video";
  // The browser reaches the API at the public address, not the server-side one.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? getApiBaseUrl();

  return (
    <section className="watch">
      {video.status === "READY" && video.playlistPath ? (
        <VideoPlayer src={`${apiUrl}${video.playlistPath}`} label={title} videoId={video.id} />
      ) : video.status === "FAILED" ? (
        <p className="notice" role="status">
          Processing this video failed. <Link href="/studio">Retry it from your studio</Link>.
        </p>
      ) : (
        <p className="notice" role="status">
          This video is still processing. Come back later.
        </p>
      )}
      <h1>{title}</h1>
      <p className="hint">
        {video.channelName} · {new Date(video.createdAt).toLocaleDateString("en", { dateStyle: "medium" })} ·{" "}
        {video.views.toLocaleString("en")} {video.views === 1 ? "view" : "views"}
      </p>
      {video.description && <p className="description">{video.description}</p>}
    </section>
  );
}
