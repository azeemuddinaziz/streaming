import { Request, Response } from "express";
import { UploadService } from "../services/upload.service";
import asyncHandler from "../utils/asyncHandler";

const uploadService = new UploadService();

/**
 * @class UploadController
 * @description Manages the HTTP interface for video upload operations.
 */
export class UploadController {
  /**
   * Creates a formal intent to upload a video file.
   * - Validates publisher identity.
   * - Records initial metadata in the system.
   * - Populates structured wideEvent logs for the domain.
   * * @param req - Express request with validated file metadata.
   * @param res - Express response.
   */
  createIntent = asyncHandler(async (req: Request, res: Response) => {
    // 1. Identity Check
    const publisherId = req.user!.id;

    // 2. Wrap Domain Logs
    req.wideEvent!.domain_data = {
      upload: {
        filename: req.body.fileName,
        size_bytes: req.body.sizeInBytes,
        mime_type: req.body.mimeType,
      },
    };

    // 3. Execution
    const result = await uploadService.initializeUpload(publisherId, req.body);

    // 4. Wrap Payload Logs
    req.wideEvent!.payload = {
      validation_failed: false,
      upload_record_id: result.videoId,
      tus_session_id: result.uploadToken,
    };

    res.status(201).json({
      status: "success",
      data: result,
    });
  });
}
