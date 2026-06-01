export type { CoordinateInput, LocationInput, LocationInputUnion, LocationMethodInput } from "./input.js";
export {
  LocationValidationError,
  validateLocationInput,
} from "./input.js";
export {
  LocationError,
  isLocationError,
  type LocationErrorCode,
} from "./errors.js";
export {
  normalizeCountryCode,
  normalizeLocationToken,
  normalizePostalCode,
} from "./normalize.js";
export type {
  ProviderLocationMappingCountry,
  ProviderLocationMappingDocument,
  ProviderLocationMappingNode,
} from "./schema.js";
export type {
  LocationPathSnapshot,
  ProviderLocationLevel,
  ProviderLocationRecord,
} from "./records.js";
export { compileMappingDocumentToRecords } from "./records.js";
export {
  MIN_RESOLUTION_SCORE,
  pickBestScoredCandidates,
  scoreLocationCandidates,
  scoreLocationRecord,
  type ScoredLocationRecord,
} from "./scoring.js";
export {
  resolveLocation,
  resolveLocationOrNull,
  type LocationResolution,
  type LocationResolverOptions,
} from "./resolver.js";
