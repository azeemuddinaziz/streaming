import { prisma } from "../lib/prisma.ts";

export class UploadRepository {
  // tusd retries a hook it did not hear back from, so recording the same
  // Upload twice leaves one record.
  static async record(data: {
    tusId: string;
    userId: string;
    filename: string;
    size: number;
  }) {
    return await prisma.upload.upsert({
      where: { tusId: data.tusId },
      create: { ...data, size: BigInt(data.size) },
      update: {},
    });
  }
}
