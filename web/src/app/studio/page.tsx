import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getStudioVideos } from "@/lib/api-client";

export const metadata: Metadata = { title: "Studio · StreamSouk" };
export const dynamic = "force-dynamic";

const STATUS_LABEL = {
  PROCESSING: "Processing",
  READY: "Ready",
  FAILED: "Failed",
} as const;

const VISIBILITY_LABEL = {
  PRIVATE: "Private",
  UNLISTED: "Unlisted",
  PUBLIC: "Public",
} as const;

export default async function StudioPage() {
  const cookieStore = await cookies();
  const videos = cookieStore.has("token")
    ? await getStudioVideos(cookieStore.toString())
    : null;
  if (!videos) redirect("/sign-in");

  return (
    <section className="studio">
      <p className="eyebrow">Studio</p>
      <h1>
        Your <em>videos</em>
      </h1>

      {videos.length === 0 ? (
        <p>
          Nothing here yet. <Link href="/upload">Upload a video</Link> to get
          started.
        </p>
      ) : (
        <ul className="video-list">
          {videos.map((video) => (
            <li key={video.id}>
              <strong>{video.label}</strong>
              <span className="hint">
                {STATUS_LABEL[video.status]} · {VISIBILITY_LABEL[video.visibility]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
