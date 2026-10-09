import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { getApiBaseUrl, getChannelPage } from "@/lib/api-client";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ name: string }> };

// The page and its metadata share one request to the API.
const load = cache((name: string) => getChannelPage(name));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await load((await params).name);
  return { title: result.ok ? `${result.channel.name} · StreamSouk` : "Channel · StreamSouk" };
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

  // The browser reaches the API at the public address, not the server-side one.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? getApiBaseUrl();

  return (
    <section className="channel">
      <p className="eyebrow">Channel</p>
      <h1>{result.channel.name}</h1>

      {result.videos.length === 0 ? (
        <p>No public videos yet.</p>
      ) : (
        <ul className="channel-grid" aria-label={`Videos by ${result.channel.name}`}>
          {result.videos.map((video) => {
            const title = video.title ?? "Untitled video";
            return (
              <li key={video.id}>
                <Link href={`/watch/${video.id}`} className="channel-video">
                  {video.thumbnailPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="thumbnail" src={`${apiUrl}${video.thumbnailPath}`} alt="" />
                  ) : (
                    <span className="thumbnail" aria-hidden="true" />
                  )}
                  <strong>{title}</strong>
                  <span className="hint">
                    {new Date(video.createdAt).toLocaleDateString("en", { dateStyle: "medium" })}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
