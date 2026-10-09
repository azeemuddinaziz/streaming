import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload as S3Upload } from "@aws-sdk/lib-storage";

// Where the bytes behind a Video live. Processing only ever reads the original
// and writes new objects; it has no way to delete anything.
export type Storage = {
  // Copies the bytes of the Upload tusd stored under `tusId` to a local file.
  downloadOriginal(tusId: string, destination: string): Promise<void>;
  // Stores a local file under `key`, replacing any object already there.
  put(key: string, file: string, contentType: string): Promise<void>;
};

// With the S3 store tusd names the object after the id before the "+", which
// carries the multipart upload id.
function objectKey(tusId: string) {
  return tusId.split("+")[0]!;
}

export function createS3Storage(bucket: string, client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: Boolean(process.env.S3_ENDPOINT),
})): Storage {
  return {
    async downloadOriginal(tusId, destination) {
      const object = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: objectKey(tusId) }),
      );
      await pipeline(object.Body as Readable, createWriteStream(destination));
    },

    async put(key, file, contentType) {
      await new S3Upload({
        client,
        params: { Bucket: bucket, Key: key, Body: createReadStream(file), ContentType: contentType },
      }).done();
    },
  };
}

// Development without S3: tusd keeps bytes in data/uploads, and processed
// files go to data/media.
export function createDiskStorage(root = path.resolve("data")): Storage {
  return {
    async downloadOriginal(tusId, destination) {
      await copyFile(path.join(root, "uploads", objectKey(tusId)), destination);
    },

    async put(key, file) {
      const target = path.join(root, "media", key);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(file, target);
    },
  };
}

export function createStorage(): Storage {
  const bucket = process.env.S3_BUCKET;
  return bucket ? createS3Storage(bucket) : createDiskStorage();
}
