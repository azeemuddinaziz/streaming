import sharp from "sharp";

export const THUMBNAIL_WIDTHS = [320, 640, 1280] as const;
export const THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024;
// The size and format a Thumbnail is addressed by (`thumbnailKey`).
export const THUMBNAIL_DEFAULT = "w640.jpg";

export type ThumbnailFile = { name: string; contentType: string; bytes: Buffer };

// Cuts an image into every size as WebP and JPEG, never enlarging it. Returns
// undefined when the bytes are not an image sharp can read.
export async function makeThumbnails(image: Buffer): Promise<ThumbnailFile[] | undefined> {
  try {
    // Orientation is applied so a phone photo is not stored sideways.
    const source = sharp(image).rotate();
    const files: ThumbnailFile[] = [];
    for (const width of THUMBNAIL_WIDTHS) {
      const resized = source.clone().resize({ width, withoutEnlargement: true });
      files.push(
        { name: `w${width}.webp`, contentType: "image/webp", bytes: await resized.clone().webp().toBuffer() },
        { name: `w${width}.jpg`, contentType: "image/jpeg", bytes: await resized.clone().jpeg({ mozjpeg: true }).toBuffer() },
      );
    }
    return files;
  } catch {
    return undefined;
  }
}
