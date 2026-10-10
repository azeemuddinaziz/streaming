import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import { enrich } from "../lib/wide-event.ts";
import { TusdService } from "../services/tusd.services.ts";
import type { HookDecision, TusHookBody, TusHookName } from "../types/tusd.types.ts";

// The tusd id lets anyone resume that upload, so events carry only a short
// fingerprint: enough to follow one upload across its hooks.
function fingerprint(tusId: string) {
  return createHash("sha256").update(tusId).digest("hex").slice(0, 16);
}

// tusd answers 200 even when it rejects, so the event says how the hook ended.
function record(outcome: "allowed" | "rejected" | "ignored" | "unhandled", rejectStatus?: number) {
  enrich({ outcome, ...(rejectStatus === undefined ? {} : { rejectStatus }) });
}

// Always HTTP 200; refusing an upload is part of the body (see tusd's hook protocol).
function respond(res: Response, decision: HookDecision) {
  if (decision.allowed) {
    record("allowed");
    return res.status(200).json({});
  }
  record("rejected", decision.status);

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

    // The name comes from the caller, so it is cut short before it is logged.
    enrich({
      tusdHook: String(hookName).slice(0, 40),
      ...(Upload?.ID ? { tusdUploadFingerprint: fingerprint(Upload.ID) } : {}),
    });

    switch (hookName) {
      case "pre-create":
        return respond(res, await TusdService.preCreate(Upload, HTTPRequest));

      case "pre-finish":
        return respond(res, await TusdService.preFinish(Upload, HTTPRequest));

      case "post-finish": {
        const { success } = await TusdService.postFinish(Upload, HTTPRequest);
        record(success ? "allowed" : "ignored");
        return res.status(200).json({});
      }

      case "post-create":
        await TusdService.postCreate(Upload, HTTPRequest);
        record("allowed");
        return res.status(200).json({});

      case "post-receive":
      case "post-terminate":
        // Acknowledged, no action taken yet.
        record("ignored");
        return res.status(200).json({});

      default:
        record("unhandled");
        return res.status(200).json({});
    }
  },
};
