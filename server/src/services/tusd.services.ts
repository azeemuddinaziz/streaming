import { UploadRepository } from "../repositories/uploads.repository.ts";
import { VideoRepository } from "../repositories/videos.repository.ts";
import { enrich, errorType } from "../lib/wide-event.ts";
import { queueVideoProcessing } from "../lib/video-queue.ts";
import { UserRepository } from "../repositories/users.repository.ts";
import type {
  PostFinishResult,
  HookDecision,
  TusHTTPRequest,
  TusUpload,
} from "../types/tusd.types.ts";
import { verifyToken } from "../utils/jwt.ts";
import { pickToken } from "../utils/request-token.ts";

// The upload server forwards the browser's headers, so the person is identified
// the same way as for the API: a Bearer token or the sign-in cookie.
async function findUploader(httpRequest: TusHTTPRequest) {
  const found = pickToken(
    httpRequest.Header?.Authorization?.[0],
    httpRequest.Header?.Cookie?.join("; "),
  );
  const verified = found && (await verifyToken(found.token));
  if (!verified) return undefined;

  return (await UserRepository.findById(verified.userId)) ?? undefined;
}

async function checkFinisher(
  upload: TusUpload,
  httpRequest: TusHTTPRequest,
): Promise<HookDecision> {
  const user = await findUploader(httpRequest);
  if (!user) {
    return { allowed: false, status: 401, reason: "Sign in to upload." };
  }

  const record = await UploadRepository.findByTusId(upload.ID);
  if (!record) {
    return { allowed: false, status: 404, reason: "Unknown upload." };
  }
  if (record.userId !== user.id) {
    return { allowed: false, status: 403, reason: "This upload is not yours." };
  }

  return { allowed: true };
}

export const TusdService = {
  async preCreate(
    upload: TusUpload,
    httpRequest: TusHTTPRequest,
  ): Promise<HookDecision> {
    if (!(await findUploader(httpRequest))) {
      return { allowed: false, status: 401, reason: "Sign in to upload." };
    }

    if (!upload.MetaData?.filename) {
      return { allowed: false, status: 400, reason: "The upload has no filename." };
    }

    if (upload.SizeIsDeferred) {
      return { allowed: false, status: 400, reason: "The upload has no size." };
    }

    return { allowed: true };
  },

  // The upload only has its id once tusd has created it, so this is where it is
  // recorded against the person who started it.
  async postCreate(upload: TusUpload, httpRequest: TusHTTPRequest) {
    const user = await findUploader(httpRequest);
    const filename = upload.MetaData?.filename;
    if (!user || !filename) return;

    await UploadRepository.record({
      tusId: upload.ID,
      userId: user.id,
      filename,
      size: upload.Size,
    });
  },

  // Checks the person finishing the upload is the one who started it.
  preFinish(
    upload: TusUpload,
    httpRequest: TusHTTPRequest,
  ): Promise<HookDecision> {
    return checkFinisher(upload, httpRequest);
  },

  // All the bytes have arrived: the Upload becomes a Video. tusd sends this
  // even when pre-finish refused the request (it only changes the response),
  // so the owner is checked again here and anyone else's finish is ignored.
  async postFinish(
    upload: TusUpload,
    httpRequest: TusHTTPRequest,
  ): Promise<PostFinishResult> {
    const decision = await checkFinisher(upload, httpRequest);
    if (!decision.allowed) return { success: false };

    const video = await UploadRepository.completeIntoVideo(upload.ID);
    if (video) {
      enrich({
        videoId: video.id,
        uploadId: video.uploadId,
        tusId: upload.ID,
        uploadSize: upload.Size,
        videoAction: "create",
      });
      // A Video nobody will process must not wait forever.
      try {
        await queueVideoProcessing(video.id);
      } catch (error) {
        enrich({ queueError: { type: errorType(error) }, statusTo: "FAILED" });
        await VideoRepository.markFailed(video.id);
      }
    }
    return { success: true };
  },
};
