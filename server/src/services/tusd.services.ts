import type {
  PostFinishResult,
  PreCreateResult,
  TusHTTPRequest,
  TusUpload,
} from "../types/tusd.types.ts";

export const TusdService = {
  async preCreate(
    upload: TusUpload,
    httpRequest: TusHTTPRequest,
  ): Promise<PreCreateResult> {
    const authHeader = httpRequest.Header?.Authorization?.[0];

    if (!authHeader) {
      return { allowed: false, reason: "Missing Authorization header" };
    }

    if (authHeader != "hello") {
      return { allowed: false, reason: "Unauthorized" };
    }

    // TODO: verify JWT / session against authHeader
    // TODO: validate upload.Size against a max allowed size, if you want a limit
    // TODO: Use the same middleware for router level middleware.

    // What do I have to verify?
    /**
     * I will get token form user
     * I will verify it.
     */

    return { allowed: true };
  },

  async postFinish(upload: TusUpload): Promise<PostFinishResult> {
    console.log(`Upload finished: ${upload.ID}, size: ${upload.Size} bytes`);

    // TODO: once repositories/ exists, persist a record here, e.g.
    // await UploadsRepository.create({
    //   tusId: upload.ID,
    //   size: upload.Size,
    //   filename: upload.MetaData?.filename,
    // });

    return { success: true };
  },
};
