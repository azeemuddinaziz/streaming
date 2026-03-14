import { randomUUID } from "node:crypto";
import { UploadRepository } from "../repositories/upload.repository";
import { UploadIntentInput } from "../schema/upload.schema";

/**
 * @service UploadService
 * @description Domain logic for managing video uploads and tusd session synchronization.
 */
export class UploadService {
  private uploadRepo = new UploadRepository();

  /**
   * Pre-registers an upload in the database and generates a unique TUS session ID.
   * @param {string} publisherId - The UUID of the user performing the upload.
   * @param {UploadIntentInput} data - Validated metadata (filename, size, etc).
   * @throws {DatabaseError} If the record fails to persist.
   * @returns {Promise<object>} Object containing uploadToken and metadata record ID.
   */
  async initializeUpload(publisherId: string, data: UploadIntentInput) {
    const tusId = randomUUID();

    const record = await this.uploadRepo.createPendingUpload(
      publisherId,
      data,
      tusId,
    );

    return {
      uploadToken: tusId,
      videoId: record.id,
      // The client uses this URL to talk to your tusd instance
      uploadUrl: `${process.env.TUSD_URL || "http://localhost:1080"}/files/${tusId}`,
    };
  }
}
