import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AlertTriangleIcon } from "lucide-react";
import { StudioFilter } from "@/components/studio/StudioFilter";
import { StudioEmpty, StudioError } from "@/components/studio/StudioNotice";
import { StudioPagination } from "@/components/studio/StudioPagination";
import { StudioVideoList } from "@/components/studio/StudioVideoList";
import { UnfinishedUploads } from "@/components/studio/UnfinishedUploads";
import { getStudioPage, getUnfinishedUploads } from "@/lib/api-client";
import { signInHref } from "@/lib/return-address";
import { lastPage, parseStudioQuery, studioHref } from "@/lib/studio-list";

export const metadata: Metadata = { title: "Studio · StreamSouk" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ page?: string | string[]; status?: string | string[] }>;

export default async function StudioPage({ searchParams }: { searchParams: SearchParams }) {
  const query = parseStudioQuery(await searchParams);
  const here = studioHref(query);

  const cookieStore = await cookies();
  if (!cookieStore.has("token")) redirect(signInHref(here));

  const cookie = cookieStore.toString();
  const [result, unfinished] = await Promise.all([getStudioPage(cookie, query), getUnfinishedUploads(cookie)]);
  if (!result.ok && result.reason === "signed-out") redirect(signInHref(here));

  // A page past the end (a bookmark, or the last Video on a page just deleted) goes to the last page.
  if (result.ok && result.videos.length === 0 && result.total > 0 && query.page > lastPage(result.total)) {
    redirect(studioHref({ ...query, page: lastPage(result.total) }));
  }

  return (
    <section>
      <h1 className="mb-6 font-serif text-4xl sm:text-5xl">Your videos</h1>

      {!unfinished.ok && (
        <p role="alert" className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangleIcon aria-hidden="true" className="size-4" />
          Your unfinished uploads could not be loaded right now.
        </p>
      )}
      {unfinished.ok && unfinished.items.length > 0 && <UnfinishedUploads uploads={unfinished.items} />}

      {!result.ok ? (
        <StudioError href={here} />
      ) : result.videos.length === 0 && !query.status ? (
        <StudioEmpty status={undefined} />
      ) : (
        <>
          <StudioFilter status={query.status} />
          {result.videos.length === 0 ? (
            <div className="mt-6">
              <StudioEmpty status={query.status} />
            </div>
          ) : (
            <>
              <p className="mt-4 text-sm text-muted-foreground">
                {result.total.toLocaleString("en")} {result.total === 1 ? "video" : "videos"}
              </p>
              <StudioVideoList videos={result.videos} page={result.page} status={query.status} />
              <StudioPagination page={result.page} total={result.total} status={query.status} />
            </>
          )}
        </>
      )}
    </section>
  );
}
