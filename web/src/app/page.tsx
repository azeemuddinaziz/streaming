import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { HomeShowcase } from "@/components/HomeShowcase";
import { Button } from "@/components/ui/button";
import { getCurrentUser, getPublicVideos } from "@/lib/api-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "StreamSouk" };

export default async function HomePage() {
  // Only the first page is fetched here; HomeShowcase loads the rest in the browser.
  const result = await getPublicVideos(1);

  return (
    <section>
      <h1 className="mb-8 font-serif text-4xl sm:text-5xl">
        Videos worth watching
      </h1>

      {!result.ok ? (
        <div role="alert" className="grid justify-items-start gap-3 rounded-lg border bg-card p-6">
          <p>Videos could not be loaded right now. Try again in a moment.</p>
          <Button asChild variant="outline">
            <Link href="/">Try again</Link>
          </Button>
        </div>
      ) : result.videos.length === 0 ? (
        <EmptyShowcase />
      ) : (
        <HomeShowcase videos={result.videos} hasMore={result.hasMore} />
      )}
    </section>
  );
}

async function EmptyShowcase() {
  const cookieStore = await cookies();
  const account = cookieStore.has("token") ? await getCurrentUser(cookieStore.toString()) : null;

  return (
    <div className="grid justify-items-start gap-3 rounded-lg border bg-card p-6">
      <p>No public videos yet. Check back soon.</p>
      {account && (
        <Button asChild>
          <Link href="/upload">Upload a video</Link>
        </Button>
      )}
    </div>
  );
}
