import { execFile, spawn } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { ExpectedJobError } from "./worker-log.ts";

const exec = promisify(execFile);
// A hung ffmpeg must throw inside the job, so the Video can still be marked failed.
const COMMAND_TIMEOUT_MS = 10 * 60 * 1000;
const run = (command: string, args: string[]) => exec(command, args, { timeout: COMMAND_TIMEOUT_MS });
// Errors only: no banner and no dump of the input, so a failure's message is its
// reason and never text embedded in the file (title, comment, location tags).
const QUIET = ["-hide_banner", "-v", "error"];

// ffmpeg or ffprobe ran and could not use the file (not a video, unreadable,
// or a non-zero exit while encoding it). The worker logs it as expected; a
// missing binary or a timeout is not the file's fault and is not this.
export class TranscodeError extends ExpectedJobError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TranscodeError";
  }
}

// A command that ran and exited non-zero rejected the file. Anything else
// (ENOENT for a missing binary, a kill on timeout) is passed on as it is.
function blameFile(error: unknown) {
  return typeof (error as { code?: unknown }).code === "number"
    ? new TranscodeError((error as Error).message, { cause: error })
    : error;
}

// Runs ffmpeg with `-progress pipe:1` and reports how far into the output it
// is, in seconds, each time it says so. Rejects on a non-zero exit or timeout.
function runFfmpeg(args: string[], onTime?: (seconds: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", [...QUIET, "-nostats", "-progress", "pipe:1", ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: COMMAND_TIMEOUT_MS,
    });
    let stderr = "";
    let pending = "";
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk).slice(-2000);
    });
    child.stdout.on("data", (chunk) => {
      pending += chunk;
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        // Both keys are microseconds; "N/A" until the first frame is out.
        const match = /^out_time_(?:us|ms)=(\d+)$/.exec(line.trim());
        if (match) onTime?.(Number(match[1]) / 1_000_000);
      }
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) resolve();
      else if (signal) reject(new Error(`ffmpeg was stopped by ${signal}: ${stderr.trim()}`));
      else reject(new TranscodeError(`ffmpeg exited with ${code}: ${stderr.trim()}`));
    });
  });
}

// Progress of a run of equal steps, 0 to 100: `done` steps finished plus
// `fraction` (0 to 1) of the current one. Never NaN, never outside 0..100.
export function stepProgress(done: number, total: number, fraction = 0) {
  if (!(total > 0)) return 0;
  const part = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  return Math.min(100, Math.max(0, ((done + part) / total) * 100));
}

export type RenditionFile = {
  width: number;
  height: number;
  bandwidth: number;
  // Playlist path relative to the output folder, e.g. "720p/index.m3u8".
  playlist: string;
};

export type Transcoded = {
  renditions: RenditionFile[];
  // Paths relative to the output folder, including playlists, segments and thumbnail.
  files: string[];
  masterPlaylist: string;
  thumbnail: string;
};

// `onProgress` gets the percent done (0 to 100, rising) of the whole transcode.
// It is never called when the source's duration is unknown. `onRendition` gets
// each Rendition's name ("720p") once it is encoded.
export type Transcoder = (
  input: string,
  outputDir: string,
  onProgress?: (percent: number) => void,
  onRendition?: (name: string) => void,
) => Promise<Transcoded>;

// Heights to encode, tallest first, with the video bitrate (kbit/s) of each.
// Only heights up to the source's are used, so nothing is upscaled.
const LADDER = [
  { height: 1080, videoKbps: 5000 },
  { height: 720, videoKbps: 2800 },
  { height: 480, videoKbps: 1400 },
  { height: 360, videoKbps: 800 },
];
const AUDIO_KBPS = 128;
const SEGMENT_SECONDS = 6;

// Length of the source in seconds, or null when ffprobe cannot tell.
async function probeDuration(input: string) {
  try {
    const { stdout } = await run("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "json", input,
    ]);
    const seconds = Number(JSON.parse(stdout).format?.duration);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  } catch {
    return null;
  }
}

async function probe(input: string) {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "json",
    input,
  ]).catch((error: unknown) => {
    throw blameFile(error);
  });
  const stream = JSON.parse(stdout).streams?.[0] as { width: number; height: number } | undefined;
  if (!stream?.width || !stream.height) throw new TranscodeError("The file has no video stream.");
  return stream;
}

// Cuts the file into HLS Renditions (video and audio together), a master
// playlist listing them, and a JPEG of the first frame. Throws a TranscodeError
// when ffmpeg cannot use the file.
export const transcode: Transcoder = async (input, outputDir, onProgress, onRendition) => {
  const source = await probe(input);
  const duration = await probeDuration(input);

  let ladder = LADDER.filter((step) => step.height <= source.height);
  // A source smaller than every step is kept at its own size.
  if (ladder.length === 0) ladder = [{ height: source.height, videoKbps: LADDER.at(-1)!.videoKbps }];

  const renditions: RenditionFile[] = [];
  const files: string[] = [];

  // One step per Rendition, plus the thumbnail.
  const steps = ladder.length + 1;
  let highest = 0;
  const report = (done: number, fraction = 0) => {
    if (duration === null) return;
    highest = Math.max(highest, stepProgress(done, steps, fraction));
    onProgress?.(highest);
  };
  report(0);

  for (const [index, step] of ladder.entries()) {
    const dir = `${step.height}p`;
    await mkdir(path.join(outputDir, dir), { recursive: true });
    await runFfmpeg([
      "-y", "-i", input,
      // First video stream, and the first audio stream when there is one.
      "-map", "0:v:0", "-map", "0:a:0?",
      "-vf", `scale=-2:${step.height}`,
      "-c:v", "libx264", "-preset", "veryfast", "-b:v", `${step.videoKbps}k`,
      "-maxrate", `${step.videoKbps}k`, "-bufsize", `${step.videoKbps * 2}k`,
      "-pix_fmt", "yuv420p",
      // A keyframe at every segment start, so segments cut cleanly.
      "-force_key_frames", `expr:gte(t,n_forced*${SEGMENT_SECONDS})`,
      "-c:a", "aac", "-b:a", `${AUDIO_KBPS}k`, "-ac", "2",
      "-f", "hls", "-hls_time", String(SEGMENT_SECONDS), "-hls_playlist_type", "vod",
      "-hls_segment_filename", path.join(outputDir, dir, "segment_%03d.ts"),
      path.join(outputDir, dir, "index.m3u8"),
    ], (seconds) => report(index, duration ? seconds / duration : 0));
    report(index + 1);

    // Scaling to an even width keeps the aspect ratio, so read the result back.
    const encoded = await probe(path.join(outputDir, dir, "segment_000.ts"));
    renditions.push({
      width: encoded.width,
      height: step.height,
      bandwidth: (step.videoKbps + AUDIO_KBPS) * 1000,
      playlist: `${dir}/index.m3u8`,
    });
    onRendition?.(dir);
  }

  const thumbnail = "thumbnail.jpg";
  await run("ffmpeg", [...QUIET, "-y", "-i", input, "-frames:v", "1", "-q:v", "2", path.join(outputDir, thumbnail)])
    .catch((error: unknown) => {
      throw blameFile(error);
    });
  report(steps);

  const masterPlaylist = "master.m3u8";
  await writeFile(
    path.join(outputDir, masterPlaylist),
    [
      "#EXTM3U",
      ...renditions.flatMap((r) => [
        `#EXT-X-STREAM-INF:BANDWIDTH=${r.bandwidth},RESOLUTION=${r.width}x${r.height}`,
        r.playlist,
      ]),
      "",
    ].join("\n"),
  );

  const listed = await readdir(outputDir, { recursive: true, withFileTypes: true });
  for (const entry of listed) {
    if (entry.isFile()) files.push(path.relative(outputDir, path.join(entry.parentPath, entry.name)));
  }

  return { renditions, files, masterPlaylist, thumbnail };
};
