import type { Metadata } from "next";
import type { WatchVideo } from "./api-client";

// The public address of the web app, read once. Absolute addresses in link
// previews come from here and never from a request's Host header.
export const WEB_ORIGIN = (process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "http://localhost:3001").replace(/\/+$/, "");

// What a chat or social post unfurls for a watch page. Only a READY, non-PRIVATE
// Video offers an image and an address to share; a private one keeps the plain
// metadata. `apiOrigin` is where the browser (and a scraper) reaches the API.
export function watchMetadata(video: WatchVideo, apiOrigin: string, webOrigin = WEB_ORIGIN): Metadata {
  const title = video.title ?? "Untitled video";
  const description = video.description ?? undefined;
  if (video.status !== "READY") return { title: "Watch · StreamSouk" };
  const base: Metadata = { title: `${title} · StreamSouk`, description };
  if (video.visibility === "PRIVATE") {
    return { ...base, openGraph: { title, description, type: "video.other" } };
  }

  const id = encodeURIComponent(video.id);
  const image = `${apiOrigin}/api/v1/videos/${id}/thumbnail`;
  return {
    ...base,
    openGraph: {
      title,
      description,
      type: "video.other",
      url: `${webOrigin}/watch/${id}`,
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export function channelMetadata(name: string, webOrigin = WEB_ORIGIN): Metadata {
  return {
    title: `${name} · StreamSouk`,
    openGraph: {
      title: `${name} · StreamSouk`,
      type: "profile",
      url: `${webOrigin}/channels/${encodeURIComponent(name)}`,
    },
  };
}
