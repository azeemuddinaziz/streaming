// An error the API reports to the caller with a specific status and message.
export class HttpError extends Error {
  status: number;
  // Response headers the answer needs, such as Retry-After on a 429.
  headers: Record<string, string>;

  constructor(status: number, message: string, headers: Record<string, string> = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.headers = headers;
  }
}
