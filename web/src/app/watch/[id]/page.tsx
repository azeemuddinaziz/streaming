import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { cache } from "react";
import { CommentSection } from "@/components/CommentSection";
import { DescriptionBox } from "@/components/DescriptionBox";
import { ReactionButtons } from "@/components/ReactionButtons";
import { ShareButton } from "@/components/ShareButton";
import { SubscribeButton } from "@/components/SubscribeButton";
import { VideoPlayer } from "@/components/VideoPlayer";
import { PrivateBadge, WatchNotice } from "@/components/WatchNotice";
import { getApiBaseUrl, getCurrentUser, getWatchVideo } from "@/lib/api-client";
import { watchMetadata } from "@/lib/share-metadata";

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
  return watchMetadata(result.video, process.env.NEXT_PUBLIC_API_URL ?? getApiBaseUrl());
}

export default async function WatchPage({ params }: Props) {
  const result = await load((await params).id);

  if (!result.ok) {
    return <WatchNotice kind={result.reason === "not-found" ? "not-found" : "unavailable"} />;
  }

  const { video } = result;
  const user = await getCurrentUser((await cookies()).toString());
  const ready = video.status === "READY";
  const signedIn = ready && user !== null;
  const title = video.title ?? "Untitled video";
  // The browser reaches the API at the public address, not the server-side one.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? getApiBaseUrl();

  return (
    <article className="grid gap-4 pb-8">
      {ready && video.playlistPath ? (
        <VideoPlayer src={`${apiUrl}${video.playlistPath}`} label={title} videoId={video.id} />
      ) : (
        <WatchNotice kind={video.status === "FAILED" ? "failed" : "processing"} />
      )}

      <div className="grid gap-2">
        <h1 className="font-sans text-xl font-semibold break-words sm:text-2xl">{title}</h1>
        {video.visibility === "PRIVATE" && (
          <div>
            <PrivateBadge />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            className="font-medium hover:underline"
            href={`/channels/${encodeURIComponent(video.channelName)}`}
          >
            {video.channelName}
          </Link>
          <SubscribeButton
            channelName={video.channelName}
            signedIn={user !== null}
            isOwner={video.isOwner}
            subscribers={video.subscribers}
            subscribed={video.subscribed === true}
          />
        </div>
        {ready && (
          <div className="flex flex-wrap items-center gap-2">
            <ReactionButtons
              videoId={video.id}
              signedIn={signedIn}
              likes={video.likes}
              dislikes={video.dislikes}
              myReaction={video.myReaction}
            />
            <ShareButton subject="video" title={title} withStartTime privateVideo={video.visibility === "PRIVATE"} />
          </div>
        )}
      </div>

      <DescriptionBox
        views={video.views}
        date={new Date(video.createdAt).toLocaleDateString("en", { dateStyle: "medium" })}
        description={video.description}
      />

      {ready && !video.commentsEnabled && (
        <p className="rounded-lg border bg-card p-4 text-sm" role="status">
          {video.isOwner
            ? "Comments are turned off for this video. Only you can see the existing ones. Turn them back on in your studio."
            : "Comments are turned off for this video."}
        </p>
      )}
      {ready && (video.commentsEnabled || video.isOwner) && (
        <CommentSection
          videoId={video.id}
          initialCount={video.comments ?? 0}
          signedIn={signedIn}
          isOwner={video.isOwner}
          commentsEnabled={video.commentsEnabled}
        />
      )}
    </article>
  );
}
