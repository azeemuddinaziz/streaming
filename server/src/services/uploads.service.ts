import { UploadRepository } from "../repositories/uploads.repository.ts";

// An Upload still unfinished this long after it started is discarded.
const UNFINISHED_LIFETIME_MS = 24 * 60 * 60 * 1000;

export const UploadService = {
  // The Uploads a person could still resume, shown to them in their studio.
  async listUnfinished(userId: string, now = new Date()) {
    const uploads = await UploadRepository.listUnfinishedForUser(
      userId,
      new Date(now.getTime() - UNFINISHED_LIFETIME_MS),
    );

    return uploads.map((upload) => ({
      id: upload.id,
      filename: upload.filename,
      size: Number(upload.size),
      createdAt: upload.createdAt,
    }));
  },

  // Removes the bytes of every Upload unfinished for over 24 hours, then marks
  // it abandoned. Completed Uploads are never selected. One failing Upload does
  // not stop the rest; the failure is reported at the end so the job is retried,
  // and an Upload whose bytes are already gone is simply marked on the retry.
  async discardStale(
    removeBytes: (tusId: string) => Promise<void>,
    now = new Date(),
  ) {
    const stale = await UploadRepository.findUnfinishedBefore(
      new Date(now.getTime() - UNFINISHED_LIFETIME_MS),
    );

    let failed = 0;
    for (const upload of stale) {
      try {
        await removeBytes(upload.tusId);
        await UploadRepository.markAbandoned(upload.id);
      } catch (error) {
        failed += 1;
        console.error(`Could not discard upload ${upload.tusId}:`, error);
      }
    }

    if (failed > 0) {
      throw new Error(`Could not discard ${failed} of ${stale.length} stale uploads.`);
    }
    return stale.length;
  },
};
