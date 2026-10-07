export interface TusUpload {
  ID: string;
  Size: number;
  SizeIsDeferred: boolean;
  Offset: number;
  MetaData?: Record<string, string>;
  IsPartial: boolean;
  IsFinal: boolean;
  PartialUploads: Record<string, string> | null;
  Storage: {
    Type: string;
    Path?: string;
    InfoPath?: string;
    Bucket?: string;
    Key?: string;
  } | null;
}

export interface TusHTTPRequest {
  Method: string;
  URI: string;
  RemoteAddr: string;
  Header?: Record<string, string[]>;
}

export interface TusHookBody {
  Type: TusHookName;
  Event: {
    Upload: TusUpload;
    HTTPRequest: TusHTTPRequest;
  };
}

export type TusHookName =
  | "pre-create"
  | "post-create"
  | "post-receive"
  | "post-finish"
  | "post-terminate";

export interface PreCreateResult {
  allowed: boolean;
  // Set when the upload is refused.
  status?: number;
  reason?: string;
}

export interface PostFinishResult {
  success: boolean;
}
