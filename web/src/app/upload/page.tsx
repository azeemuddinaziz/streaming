import type { Metadata } from "next";
import { AlertTriangleIcon } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signInHref } from "@/lib/return-address";
import { UploadForm } from "@/components/UploadForm";
import { UnfinishedUploads } from "@/components/studio/UnfinishedUploads";
import { getCurrentUser, getUnfinishedUploads } from "@/lib/api-client";

export const metadata: Metadata = { title: "Upload · StreamSouk" };
export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const cookieStore = await cookies();
  const cookie = cookieStore.toString();
  const [account, unfinished] = cookieStore.has("token")
    ? await Promise.all([getCurrentUser(cookie), getUnfinishedUploads(cookie)])
    : [null, null];
  if (!account) redirect(signInHref("/upload"));

  const uploads = unfinished?.ok ? unfinished.items : [];

  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="mb-6 font-serif text-4xl sm:text-5xl">Upload a video</h1>
      <UploadForm unfinishedNames={uploads.map((upload) => upload.filename)} />

      {unfinished && !unfinished.ok && (
        <p role="alert" className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangleIcon aria-hidden="true" className="size-4" />
          Your unfinished uploads could not be loaded right now.
        </p>
      )}
      {uploads.length > 0 && (
        <div className="mt-8">
          <UnfinishedUploads uploads={uploads} resumeLink={false} />
        </div>
      )}
    </section>
  );
}
