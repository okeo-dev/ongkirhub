export type OngkirHubErrorCode =
  | "VALIDATION_ERROR"
  | "PROVIDER_ERROR"
  | "UPSTREAM_ERROR"
  | "NETWORK_ERROR"
  | "TIMEOUT_ERROR"
  | "PARSE_ERROR"
  | "UNKNOWN_ERROR";

export interface OngkirHubErrorContext {
  status?: number;
  providerKey?: string;
  details?: unknown;
  url?: string;
}

export class OngkirHubError extends Error {
  readonly code: OngkirHubErrorCode;
  readonly context: OngkirHubErrorContext;

  constructor(
    code: OngkirHubErrorCode,
    message: string,
    context: OngkirHubErrorContext = {},
  ) {
    super(message);
    this.name = "OngkirHubError";
    this.code = code;
    this.context = context;
  }
}

export function isOngkirHubError(error: unknown): error is OngkirHubError {
  return error instanceof OngkirHubError;
}
