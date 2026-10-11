import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { cache } from "react";
import { ShareButton } from "@/components/ShareButton";
import { SubscribeButton } from "@/components/SubscribeButton";
import { VideoCard } from "@/components/VideoCard";
import { getChannelPage, getCurrentUser } from "@/lib/api-client";
import { channelMetadata } from "@/lib/share-metadata";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ name: string }> };

// The page and its metadata share one request to the API.
const load = cache(async (name: string) => getChannelPage(name, (await cookies()).toString()));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await load((await params).name);
  if (result.ok) return channelMetadata(result.channel.name);
  return { title: result.reason === "not-found" ? "Channel not found · StreamSouk" : "Channel · StreamSouk" };
}

export default async function ChannelPage({ params }: Props) {
  const result = await load((await params).name);

  if (!result.ok) {
    return result.reason === "not-found" ? (
      <section className="channel">
        <p className="eyebrow">Channel</p>
        <h1>
          Channel <em>not found</em>
        </h1>
        <p>No one has this account name.</p>
        <p>
          <Link href="/">Back to StreamSouk</Link>
        </p>
      </section>
    ) : (
      <section className="channel">
        <p role="alert">This channel could not be loaded right now. Try again in a moment.</p>
      </section>
    );
  }

  const user = await getCurrentUser((await cookies()).toString());
  const isOwner = user !== null && user.user.name.toLowerCase() === result.channel.name.toLowerCase();

  return (
    <section className="channel">
      <p className="eyebrow">Channel</p>
      <h1>{result.channel.name}</h1>
      <div className="flex flex-wrap items-center gap-3">
        <SubscribeButton
          channelName={result.channel.name}
          signedIn={user !== null}
          isOwner={isOwner}
          subscribers={result.subscribers}
          subscribed={result.subscribed === true}
        />
        <ShareButton subject="channel" title={`${result.channel.name} on StreamSouk`} />
      </div>

      {result.videos.length === 0 ? (
        <p>No public videos yet.</p>
      ) : (
        <ul className="channel-grid" aria-label={`Videos by ${result.channel.name}`}>
          {result.videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </ul>
      )}
    </section>
  );
}
