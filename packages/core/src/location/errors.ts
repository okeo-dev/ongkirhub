export type LocationErrorCode =
  | "LOCATION_NOT_FOUND"
  | "LOCATION_AMBIGUOUS"
  | "LOCATION_RESOLVER_NOT_CONFIGURED"
  | "LOCATION_RESOLUTION_FAILED";

export class LocationError extends Error {
  readonly code: LocationErrorCode;
  readonly providerKey?: string;
  readonly cause?: unknown;

  constructor(
    code: LocationErrorCode,
    message: string,
    options?: { providerKey?: string; cause?: unknown },
  ) {
    super(message);
    this.name = "LocationError";
    this.code = code;
    this.providerKey = options?.providerKey;
    this.cause = options?.cause;
  }
}

export function isLocationError(error: unknown): error is LocationError {
  return error instanceof LocationError;
}
