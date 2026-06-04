import type { LocationInput } from "@ongkirhub/core";
import type { NormalizedGooglePlace } from "./types.js";

export interface ToLocationInputOptions {
  resultType?: "hierarchy" | "postalCode" | "full";
}

export function toLocationInput(
  normalized: NormalizedGooglePlace,
  options: ToLocationInputOptions = {},
): LocationInput {
  const resultType = options.resultType ?? "hierarchy";

  if (!normalized.countryCode) {
    throw new Error("Normalized place is missing countryCode");
  }

  const input: LocationInput = {
    method: "location",
    countryCode: normalized.countryCode,
  };

  if (resultType === "postalCode") {
    if (normalized.postalCode) {
      input.postalCode = normalized.postalCode;
    }
    return input;
  }

  if (resultType === "hierarchy" || resultType === "full") {
    if (normalized.level1) input.level1 = normalized.level1;
    if (normalized.level2) input.level2 = normalized.level2;
    if (normalized.level3) input.level3 = normalized.level3;
    if (normalized.level4) input.level4 = normalized.level4;
  }

  if (resultType === "full" && normalized.postalCode) {
    input.postalCode = normalized.postalCode;
  }

  return input;
}
