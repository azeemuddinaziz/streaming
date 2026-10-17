import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

// Generates a short test-pattern clip with a sine tone (nothing committed or
// downloaded) and stores it where tusd would have: data/uploads/<tusId>.
// Returns its size in bytes.
export async function storeDemoClip(tusId: string, index: number, root = path.resolve("data")) {
  const dir = await mkdtemp(path.join(tmpdir(), "seed-clip-"));
  try {
    const file = path.join(dir, "clip.mp4");
    await exec("ffmpeg", [
      "-y", "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=25:duration=8",
      "-f", "lavfi", "-i", `sine=frequency=${220 + index * 40}:duration=8`,
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", file,
    ]);
    await mkdir(path.join(root, "uploads"), { recursive: true });
    await copyFile(file, path.join(root, "uploads", tusId));
    return (await stat(file)).size;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
