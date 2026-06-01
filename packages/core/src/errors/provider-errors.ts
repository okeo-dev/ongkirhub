export type ProviderErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_PROVIDER_CONFIG"
  | "UPSTREAM_AUTH_FAILURE"
  | "UPSTREAM_RATE_LIMIT"
  | "UPSTREAM_UNAVAILABLE"
  | "UNSUPPORTED_ROUTE"
  | "UNKNOWN_PROVIDER_FAILURE";

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly providerKey?: string;
  readonly cause?: unknown;

  constructor(
    code: ProviderErrorCode,
    message: string,
    options?: { providerKey?: string; cause?: unknown },
  ) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.providerKey = options?.providerKey;
    this.cause = options?.cause;
  }
}

export function isProviderError(error: unknown): error is ProviderError {
  return error instanceof ProviderError;
}
