import type { LocationInput } from "@ongkirhub/core";
import type { GooglePlaceInput } from "./types.js";
import { normalizeGooglePlace } from "./normalize.js";
import { toLocationInput, type ToLocationInputOptions } from "./project.js";

export function googlePlaceToLocationInput(
  place: GooglePlaceInput,
  options?: ToLocationInputOptions,
): LocationInput {
  return toLocationInput(normalizeGooglePlace(place), options);
}
