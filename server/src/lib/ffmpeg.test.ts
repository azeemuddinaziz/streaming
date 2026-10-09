import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { transcode } from "./ffmpeg.ts";

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
const dir = mkdtempSync(path.join(tmpdir(), "ffmpeg-test-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function sample(name: string, size: string, { audio = true } = {}) {
  const file = path.join(dir, name);
  execFileSync("ffmpeg", [
    "-y", "-f", "lavfi", "-i", `testsrc=size=${size}:rate=25:duration=2`,
    ...(audio ? ["-f", "lavfi", "-i", "sine=frequency=440:duration=2"] : []),
    "-pix_fmt", "yuv420p", file,
  ], { stdio: "ignore" });
  return file;
}

function streams(file: string, type: "audio" | "video") {
  const probed = JSON.parse(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type", "-of", "json", file]).toString(),
  );
  return probed.streams.filter((stream: { codec_type: string }) => stream.codec_type === type).length;
}

describe.skipIf(!hasFfmpeg)("transcode (needs ffmpeg)", () => {
  it("makes several Renditions with audio, a master playlist and a first-frame thumbnail", async () => {
    const out = path.join(dir, "out");
    const result = await transcode(sample("hd.mp4", "1280x720"), out);

    expect(result.renditions.map((r) => r.height)).toEqual([720, 480, 360]);
    for (const rendition of result.renditions) {
      expect(streams(path.join(out, rendition.playlist.replace("index.m3u8", "segment_000.ts")), "audio")).toBe(1);
    }
    const master = readFileSync(path.join(out, result.masterPlaylist), "utf8");
    expect(master).toContain("720p/index.m3u8");
    expect(master).toContain("360p/index.m3u8");
    expect(result.files).toContain("thumbnail.jpg");
    expect(streams(path.join(out, "thumbnail.jpg"), "video")).toBe(1);
  }, 120_000);

  it("keeps a tiny source at its own size, and handles a file with no audio", async () => {
    const out = path.join(dir, "out-small");
    const result = await transcode(sample("small.mp4", "320x240", { audio: false }), out);

    expect(result.renditions.map((r) => r.height)).toEqual([240]);
  }, 120_000);

  it("fails on a file that is not a video", async () => {
    const bad = path.join(dir, "bad.mp4");
    execFileSync("sh", ["-c", `echo nope > ${bad}`]);

    await expect(transcode(bad, path.join(dir, "out-bad"))).rejects.toThrow();
  });
});
