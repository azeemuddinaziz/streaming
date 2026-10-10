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

  // Marks every Upload unfinished for over 24 hours abandoned, then removes its
  // bytes. Marking comes first so an Upload finishing at that moment cannot
  // become a Video whose bytes are about to go. Completed Uploads are never
  // selected. One failing Upload is given back and does not stop the rest; the
  // failure is reported at the end so the job is retried.
  async discardStale(
    removeBytes: (tusId: string) => Promise<void>,
    now = new Date(),
  ) {
    const stale = await UploadRepository.findUnfinishedBefore(
      new Date(now.getTime() - UNFINISHED_LIFETIME_MS),
    );

    const failed: string[] = [];
    for (const upload of stale) {
      if (!(await UploadRepository.claimForDiscard(upload.id))) continue;

      try {
        await removeBytes(upload.tusId);
      } catch (error) {
        await UploadRepository.releaseDiscardClaim(upload.id);
        failed.push(upload.tusId);
      }
    }

    if (failed.length > 0) {
      // The job runner keeps this message with the failed job.
      throw new Error(
        `Could not discard ${failed.length} of ${stale.length} stale uploads: ${failed.join(", ")}.`,
      );
    }
    return stale.length;
  },
};
