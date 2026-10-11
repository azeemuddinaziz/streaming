import { describe, expect, it } from "vitest";
import type { WatchVideo } from "./api-client";
import { channelMetadata, watchMetadata } from "./share-metadata";

const video = {
  id: "v1",
  title: "Holiday",
  description: "Two weeks away",
  status: "READY",
  visibility: "PUBLIC",
} as WatchVideo;
const api = "https://api.example.com";
const web = "https://streamsouk.example";

describe("watchMetadata", () => {
  it("gives a ready public or unlisted Video an absolute image, url and a large Twitter card", () => {
    for (const visibility of ["PUBLIC", "UNLISTED"] as const) {
      const metadata = watchMetadata({ ...video, visibility }, api, web);

      expect(metadata.openGraph).toMatchObject({
        url: "https://streamsouk.example/watch/v1",
        images: ["https://api.example.com/api/v1/videos/v1/thumbnail"],
      });
      expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
    }
  });

  it("leaves a private Video without an image or an address", () => {
    const metadata = watchMetadata({ ...video, visibility: "PRIVATE" }, api, web);

    expect(metadata.openGraph).not.toHaveProperty("images");
    expect(metadata.openGraph).not.toHaveProperty("url");
    expect(metadata.twitter).toBeUndefined();
  });

  it("keeps the plain title for a Video that is not ready", () => {
    expect(watchMetadata({ ...video, status: "PROCESSING" }, api, web)).toEqual({ title: "Watch · StreamSouk" });
  });
});

describe("channelMetadata", () => {
  it("has a title and an address, and no image", () => {
    const metadata = channelMetadata("Ada-Lovelace", web);

    expect(metadata.openGraph).toMatchObject({
      title: "Ada-Lovelace · StreamSouk",
      url: "https://streamsouk.example/channels/Ada-Lovelace",
    });
    expect(metadata.openGraph).not.toHaveProperty("images");
  });
});
