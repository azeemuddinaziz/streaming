import { UploadRepository } from "../repositories/uploads.repository.ts";
import { UserRepository } from "../repositories/users.repository.ts";
import type {
  PostFinishResult,
  PreCreateResult,
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

export const TusdService = {
  async preCreate(
    upload: TusUpload,
    httpRequest: TusHTTPRequest,
  ): Promise<PreCreateResult> {
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

  async postFinish(upload: TusUpload): Promise<PostFinishResult> {
    console.log(`Upload finished: ${upload.ID}, size: ${upload.Size} bytes`);
    return { success: true };
  },
};
