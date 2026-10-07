import type { Request, Response } from "express";
import { TusdService } from "../services/tusd.services.ts";
import type { TusHookBody, TusHookName } from "../types/tusd.types.ts";

export const WebhooksController = {
  async tusd(req: Request, res: Response) {
    const { Type, Event } = req.body as TusHookBody;
    const { Upload, HTTPRequest } = Event;

    const hookName =
      Type || (req.header("Hook-Name") as TusHookName | undefined);

    switch (hookName) {
      case "pre-create": {
        const result = await TusdService.preCreate(Upload, HTTPRequest);

        if (!result.allowed) {
          return res.status(200).json({
            RejectUpload: true,
            HTTPResponse: {
              StatusCode: result.status,
              Body: JSON.stringify({ message: result.reason }),
            },
          });
        }

        return res.status(200).json({});
      }

      case "post-finish": {
        await TusdService.postFinish(Upload);
        return res.status(200).json({});
      }

      case "post-create":
        await TusdService.postCreate(Upload, HTTPRequest);
        return res.status(200).json({});

      case "post-receive":
      case "post-terminate":
        // Acknowledged, no action taken yet.
        return res.status(200).json({});

      default:
        console.warn(`Unhandled tusd hook: ${hookName}`);
        return res.status(200).json({});
    }
  },
};
