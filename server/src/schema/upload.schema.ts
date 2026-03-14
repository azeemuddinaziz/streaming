import { z } from "zod";

export const createUploadIntentSchema = z.object({
  body: z.object({
    fileName: z.string().min(1).trim(),
    sizeInBytes: z.number().positive(),
    mimeType: z.string().startsWith("video/"),
  }),
});

export type UploadIntentInput = z.infer<
  typeof createUploadIntentSchema
>["body"];
