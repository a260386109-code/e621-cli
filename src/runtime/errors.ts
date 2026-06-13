export class CliError extends Error {
  readonly type: string;
  readonly status?: number;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(
    message: string,
    options: {
      type?: string;
      status?: number;
      retryable?: boolean;
      details?: unknown;
    } = {}
  ) {
    super(message);
    this.name = "CliError";
    this.type = options.type ?? "CliError";
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 520 || status === 522 || status === 524;
}

export function statusType(status: number): string {
  if (status === 401) return "Unauthorized";
  if (status === 403) return "Forbidden";
  if (status === 404) return "NotFound";
  if (status === 410) return "Gone";
  if (status === 412) return "PreconditionFailed";
  if (status === 422) return "UnprocessableContent";
  if (status === 429) return "RateLimited";
  if (status >= 500) return "ServerError";
  if (status >= 400) return "HttpError";
  return "HttpStatus";
}
