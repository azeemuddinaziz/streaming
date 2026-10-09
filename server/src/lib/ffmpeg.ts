import { execFile } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

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

export type Transcoder = (input: string, outputDir: string) => Promise<Transcoded>;

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

async function probe(input: string) {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "json",
    input,
  ]);
  const stream = JSON.parse(stdout).streams?.[0] as { width: number; height: number } | undefined;
  if (!stream?.width || !stream.height) throw new Error("The file has no video stream.");
  return stream;
}

// Cuts the file into HLS Renditions (video and audio together), a master
// playlist listing them, and a JPEG of the first frame. Throws when ffmpeg
// cannot read the file.
export const transcode: Transcoder = async (input, outputDir) => {
  const source = await probe(input);

  let ladder = LADDER.filter((step) => step.height <= source.height);
  // A source smaller than every step is kept at its own size.
  if (ladder.length === 0) ladder = [{ height: source.height, videoKbps: LADDER.at(-1)!.videoKbps }];

  const renditions: RenditionFile[] = [];
  const files: string[] = [];

  for (const step of ladder) {
    const dir = `${step.height}p`;
    await mkdir(path.join(outputDir, dir), { recursive: true });
    await run("ffmpeg", [
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
    ]);

    // Scaling to an even width keeps the aspect ratio, so read the result back.
    const encoded = await probe(path.join(outputDir, dir, "segment_000.ts"));
    renditions.push({
      width: encoded.width,
      height: step.height,
      bandwidth: (step.videoKbps + AUDIO_KBPS) * 1000,
      playlist: `${dir}/index.m3u8`,
    });
  }

  const thumbnail = "thumbnail.jpg";
  await run("ffmpeg", ["-y", "-i", input, "-frames:v", "1", "-q:v", "2", path.join(outputDir, thumbnail)]);

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
