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
    // A small file can still decode to a huge bitmap, so cap the pixels.
    const input = sharp(image, { limitInputPixels: 40_000_000 });
    // Only raster formats; SVG would be parsed by a vector renderer.
    const { format } = await input.metadata();
    if (!format || !["jpeg", "png", "webp", "gif", "avif", "heif", "tiff"].includes(format)) {
      return undefined;
    }
    // Orientation is applied so a phone photo is not stored sideways.
    const source = input.rotate();
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
