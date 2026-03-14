import { UUID } from "node:crypto";

declare global {
  namespace Express {
    interface Request {
      id: string | UUID;
      wideEvent: Record<string, unknown>;
      user?: { id: string };
    }
  }
}

export interface RequestContext {
  requestId: string;
}

export {};
