import { ProviderError } from "../errors/provider-errors.js";
import {
  LocationValidationError,
  validateLocationInput,
} from "../location/input.js";
import type { Parcel, QuoteRequest } from "../types/shipment.js";

function assertParcel(value: unknown, index: number): asserts value is Parcel {
  if (value === null || typeof value !== "object") {
    throw new ProviderError(
      "INVALID_REQUEST",
      `parcels[${index}] must be an object`,
    );
  }
  const parcel = value as Parcel;
  if (
    typeof parcel.weightGrams !== "number" ||
    !Number.isFinite(parcel.weightGrams) ||
    parcel.weightGrams <= 0
  ) {
    throw new ProviderError(
      "INVALID_REQUEST",
      `parcels[${index}].weightGrams must be a positive number`,
    );
  }
}

function assertLocation(value: unknown, field: string, role: "origin" | "destination") {
  try {
    return validateLocationInput(value, field, role);
  } catch (error) {
    if (error instanceof LocationValidationError) {
      throw new ProviderError("INVALID_REQUEST", error.message);
    }
    throw error;
  }
}

export function validateQuoteRequest(input: unknown): QuoteRequest {
  if (input === null || typeof input !== "object") {
    throw new ProviderError("INVALID_REQUEST", "Request body must be an object");
  }

  const body = input as Record<string, unknown>;

  const origin = assertLocation(body.origin, "origin", "origin");
  const destination = assertLocation(body.destination, "destination", "destination");

  if (!Array.isArray(body.parcels) || body.parcels.length === 0) {
    throw new ProviderError(
      "INVALID_REQUEST",
      "parcels must be a non-empty array",
    );
  }

  body.parcels.forEach((parcel, index) => assertParcel(parcel, index));

  if (
    typeof body.totalWeightGrams !== "number" ||
    !Number.isFinite(body.totalWeightGrams) ||
    body.totalWeightGrams <= 0
  ) {
    throw new ProviderError(
      "INVALID_REQUEST",
      "totalWeightGrams must be a positive number",
    );
  }

  return {
    origin,
    destination,
    parcels: body.parcels as Parcel[],
    totalWeightGrams: body.totalWeightGrams,
    declaredValue: body.declaredValue as QuoteRequest["declaredValue"],
    metadata: body.metadata as QuoteRequest["metadata"],
  };
}
