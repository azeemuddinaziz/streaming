import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { cache } from "react";
import { ChannelNotice } from "@/components/ChannelNotice";
import { ChannelVideos } from "@/components/ChannelVideos";
import { ShareButton } from "@/components/ShareButton";
import { SubscribeButton } from "@/components/SubscribeButton";
import { Button } from "@/components/ui/button";
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
  const { name } = await params;
  const result = await load(name);

  if (!result.ok) return <ChannelNotice kind={result.reason} name={name} />;

  const user = await getCurrentUser((await cookies()).toString());
  const isOwner = user !== null && user.user.name.toLowerCase() === result.channel.name.toLowerCase();

  return (
    <section>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="break-words font-serif text-4xl sm:text-5xl">{result.channel.name}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <SubscribeButton
            channelName={result.channel.name}
            signedIn={user !== null}
            isOwner={isOwner}
            subscribers={result.subscribers}
            subscribed={result.subscribed === true}
          />
          <ShareButton subject="channel" title={`${result.channel.name} on StreamSouk`} />
        </div>
      </header>

      {result.videos.length === 0 ? (
        <div className="grid justify-items-start gap-3 rounded-lg border bg-card p-6">
          <p>No public videos yet.</p>
          {isOwner && (
            <Button asChild>
              <Link href="/upload">Upload a video</Link>
            </Button>
          )}
        </div>
      ) : (
        // Only the first page is fetched here; ChannelVideos loads the rest in the browser.
        <ChannelVideos channelName={result.channel.name} videos={result.videos} hasMore={result.hasMore} />
      )}
    </section>
  );
}
