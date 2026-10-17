import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { stepProgress, transcode, TranscodeError } from "./ffmpeg.ts";

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

describe("stepProgress", () => {
  it("adds the current step's fraction to the finished ones", () => {
    expect(stepProgress(0, 4)).toBe(0);
    expect(stepProgress(1, 4, 0.5)).toBe(37.5);
    expect(stepProgress(4, 4)).toBe(100);
  });

  it("never gives NaN or a value outside 0 to 100", () => {
    expect(stepProgress(0, 0)).toBe(0);
    expect(stepProgress(1, 2, Number.NaN)).toBe(50);
    expect(stepProgress(1, 2, 7)).toBe(100);
    expect(stepProgress(0, 2, -1)).toBe(0);
  });
});

describe("transcode failures", () => {
  it("does not blame the file when ffmpeg cannot be started", async () => {
    const file = path.join(dir, "any.mp4");
    execFileSync("sh", ["-c", `echo bytes > ${file}`]);
    const pathBefore = process.env.PATH;
    // A PATH with no ffmpeg or ffprobe on it.
    process.env.PATH = dir;
    const error = await transcode(file, path.join(dir, "out-none")).catch((e: unknown) => e);
    process.env.PATH = pathBefore;

    expect(error).not.toBeInstanceOf(TranscodeError);
    expect((error as { code?: string }).code).toBe("ENOENT");
  });
});

describe.skipIf(!hasFfmpeg)("transcode (needs ffmpeg)", () => {
  it("makes several Renditions with audio, a master playlist and a first-frame thumbnail", async () => {
    const out = path.join(dir, "out");
    const finished: string[] = [];
    const result = await transcode(sample("hd.mp4", "1280x720"), out, undefined, (name) => finished.push(name));

    expect(result.renditions.map((r) => r.height)).toEqual([720, 480, 360]);
    expect(finished).toEqual(["720p", "480p", "360p"]);
    for (const rendition of result.renditions) {
      expect(streams(path.join(out, rendition.playlist.replace("index.m3u8", "segment_000.ts")), "audio")).toBe(1);
    }
    const master = readFileSync(path.join(out, result.masterPlaylist), "utf8");
    expect(master).toContain("720p/index.m3u8");
    expect(master).toContain("360p/index.m3u8");
    expect(result.files).toContain("thumbnail.jpg");
    expect(streams(path.join(out, "thumbnail.jpg"), "video")).toBe(1);
  }, 120_000);

  it("reports rising progress from 0 to 100 across Renditions", async () => {
    const seen: number[] = [];
    await transcode(sample("progress.mp4", "1280x720"), path.join(dir, "out-progress"), (p) => seen.push(p));

    expect(seen.length).toBeGreaterThan(2);
    expect(seen.every((p) => Number.isFinite(p) && p >= 0 && p <= 100)).toBe(true);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(seen[0]).toBe(0);
    expect(seen.at(-1)).toBe(100);
  }, 120_000);

  it("keeps a tiny source at its own size, and handles a file with no audio", async () => {
    const out = path.join(dir, "out-small");
    const result = await transcode(sample("small.mp4", "320x240", { audio: false }), out);

    expect(result.renditions.map((r) => r.height)).toEqual([240]);
  }, 120_000);

  it("fails on a file that is not a video", async () => {
    const bad = path.join(dir, "bad.mp4");
    execFileSync("sh", ["-c", `echo nope > ${bad}`]);

    await expect(transcode(bad, path.join(dir, "out-bad"))).rejects.toBeInstanceOf(TranscodeError);
  });
});
