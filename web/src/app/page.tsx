import type { Metadata } from "next";
import Link from "next/link";
import { VideoCard } from "@/components/VideoCard";
import { getPublicVideos } from "@/lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "StreamSouk" };

type Props = { searchParams: Promise<{ page?: string }> };

export default async function HomePage({ searchParams }: Props) {
  const parsed = Number((await searchParams).page);
  const page = Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
  const result = await getPublicVideos(page);

  return (
    <section className="showcase">
      <p className="eyebrow">Public videos</p>
      <h1>
        Videos worth <em>watching</em>
      </h1>

      {!result.ok ? (
        <p role="alert">Videos could not be loaded right now. Try again in a moment.</p>
      ) : result.videos.length === 0 ? (
        <p>
          {page === 1 ? (
            "No public videos yet. Check back soon."
          ) : (
            <>
              There is nothing on this page. <Link href="/">Back to the first page</Link>.
            </>
          )}
        </p>
      ) : (
        <>
          <ul className="channel-grid" aria-label="Public videos">
            {result.videos.map((video) => (
              <VideoCard key={video.id} video={video} channelName={video.channelName} />
            ))}
          </ul>
          {(page > 1 || result.hasMore) && (
            <nav className="pager" aria-label="Pages">
              {page > 1 ? (
                <Link href={page === 2 ? "/" : `/?page=${page - 1}`} rel="prev">
                  ← Newer
                </Link>
              ) : (
                <span />
              )}
              <span className="hint">Page {page}</span>
              {result.hasMore ? (
                <Link href={`/?page=${page + 1}`} rel="next">
                  Older →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </section>
  );
}
