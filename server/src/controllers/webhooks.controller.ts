import type { Request, Response } from "express";
import { TusdService } from "../services/tusd.services.ts";
import type { HookDecision, TusHookBody, TusHookName } from "../types/tusd.types.ts";

// Always HTTP 200; refusing an upload is part of the body (see tusd's hook protocol).
function respond(res: Response, decision: HookDecision) {
  if (decision.allowed) return res.status(200).json({});

  return res.status(200).json({
    RejectUpload: true,
    HTTPResponse: {
      StatusCode: decision.status,
      Body: JSON.stringify({ message: decision.reason }),
    },
  });
}

export const WebhooksController = {
  async tusd(req: Request, res: Response) {
    const { Type, Event } = req.body as TusHookBody;
    const { Upload, HTTPRequest } = Event;

    const hookName =
      Type || (req.header("Hook-Name") as TusHookName | undefined);

    switch (hookName) {
      case "pre-create":
        return respond(res, await TusdService.preCreate(Upload, HTTPRequest));

      case "pre-finish":
        return respond(res, await TusdService.preFinish(Upload, HTTPRequest));

      case "post-finish": {
        await TusdService.postFinish(Upload, HTTPRequest);
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
