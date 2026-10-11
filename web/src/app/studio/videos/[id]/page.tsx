import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EditVideoForm } from "@/components/studio/EditVideoForm";
import { EditVideoError, EditVideoNotFound } from "@/components/studio/EditVideoNotice";
import { StatusBadge } from "@/components/studio/StatusBadge";
import { ThumbnailPicker } from "@/components/ThumbnailPicker";
import { Button } from "@/components/ui/button";
import { getCurrentUser, getWatchVideo } from "@/lib/api-client";
import { signInHref } from "@/lib/return-address";

export const metadata: Metadata = { title: "Edit details · StreamSouk" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditVideoPage({ params }: Props) {
  const { id } = await params;
  const here = `/studio/videos/${encodeURIComponent(id)}`;

  const cookieStore = await cookies();
  if (!cookieStore.has("token")) redirect(signInHref(here));
  const cookie = cookieStore.toString();

  const [result, user] = await Promise.all([getWatchVideo(id, cookie), getCurrentUser(cookie)]);
  if (user === null) redirect(signInHref(here));
  if (!result.ok && result.reason === "unavailable") return <EditVideoError href={here} />;
  // Someone else's Video is shown as not found, the same as a missing one.
  if (!result.ok || !result.video.isOwner) return <EditVideoNotFound />;

  const { video } = result;
  const label = video.label ?? video.title ?? "Untitled";
  const ready = video.status === "READY";

  return (
    <section>
      <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
        <Link href="/studio">
          <ArrowLeftIcon aria-hidden="true" />
          Your videos
        </Link>
      </Button>
      <h1 className="font-serif text-4xl sm:text-5xl">Edit details</h1>
      <p className="mt-2 mb-8 break-words text-muted-foreground">{label}</p>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <EditVideoForm
          videoId={video.id}
          initial={{
            title: video.title ?? "",
            description: video.description ?? "",
            visibility: video.visibility,
            commentsEnabled: video.commentsEnabled,
          }}
        />

        <aside aria-label="Preview" className="grid content-start gap-4">
          {ready ? (
            <ThumbnailPicker videoId={video.id} label={label} thumbnailPath={video.thumbnailPath ?? null} />
          ) : (
            <p className="rounded-md border bg-card p-3 text-sm text-muted-foreground">
              {video.status === "FAILED"
                ? "Processing failed, so there is no thumbnail. You can retry it from your videos."
                : "The thumbnail can be changed once processing has finished."}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={video.status} />
            {ready && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/watch/${video.id}`}>Watch</Link>
              </Button>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
