import { prisma } from "../lib/prisma";
import { UploadIntentInput } from "../schema/upload.schema";

/**
 * @repository UploadRepository
 * @description Handles direct Prisma persistence for upload-related records.
 */
export class UploadRepository {
  /**
   * Persists a new upload record with a 'PENDING' status.
   * * @param publisherId - The UUID of the user who owns the video.
   * @param data - The file metadata (name, size, type).
   * @param tusId - The session identifier generated for the tusd service.
   * @returns The created Prisma record.
   */
  async createPendingUpload(
    publisherId: string,
    data: UploadIntentInput,
    tusId: string,
  ) {
    return prisma.upload.create({
      data: {
        publisherId: publisherId,
        filename: data.fileName,
        tus_id: tusId,
        status: "PENDING",
      },
    });
  }
}
