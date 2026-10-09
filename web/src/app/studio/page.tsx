import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { VideoDetailsForm } from "@/components/VideoDetailsForm";
import { RetryButton } from "@/components/RetryButton";
import { getStudioVideos, getUnfinishedUploads } from "@/lib/api-client";

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
  if (!cookieStore.has("token")) redirect("/sign-in");

  const cookie = cookieStore.toString();
  const [result, unfinished] = await Promise.all([
    getStudioVideos(cookie),
    getUnfinishedUploads(cookie),
  ]);
  if (!result.ok && result.reason === "signed-out") redirect("/sign-in");

  return (
    <section className="studio">
      <p className="eyebrow">Studio</p>
      <h1>
        Your <em>videos</em>
      </h1>

      {!result.ok ? (
        <p role="alert">
          Your videos could not be loaded right now. Try again in a moment.
        </p>
      ) : result.items.length === 0 ? (
        <p>
          Nothing here yet. <Link href="/upload">Upload a video</Link> to get
          started.
        </p>
      ) : (
        <ul className="video-list">
          {result.items.map((video) => (
            <li key={video.id}>
              <strong>{video.label}</strong>
              <span className="hint">
                {STATUS_LABEL[video.status]} · {VISIBILITY_LABEL[video.visibility]}
              </span>
              {video.status === "FAILED" && <RetryButton videoId={video.id} />}
              <VideoDetailsForm video={video} />
            </li>
          ))}
        </ul>
      )}

      {!unfinished.ok && (
        <p role="alert">Your unfinished uploads could not be loaded right now.</p>
      )}

      {unfinished.ok && unfinished.items.length > 0 && (
        <>
          <h2>Unfinished uploads</h2>
          <p className="hint">
            These stopped part way. <Link href="/upload">Choose the same file again</Link>{" "}
            to carry on where it stopped. They are discarded 24 hours after they
            started.
          </p>
          <ul className="video-list">
            {unfinished.items.map((upload) => (
              <li key={upload.id}>
                <strong>{upload.filename}</strong>
                <span className="hint">Needs resume</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
