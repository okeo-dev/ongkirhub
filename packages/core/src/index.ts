export type {
  CoverageScope,
  ProviderCapabilities,
} from "./types/capabilities.js";
export {
  ProviderError,
  isProviderError,
  type ProviderErrorCode,
} from "./errors/provider-errors.js";
export type { Duration, DurationUnit, Quote } from "./types/quote.js";
export type { ShippingProvider } from "./types/provider.js";
export type {
  Dimensions,
  Money,
  Parcel,
  QuoteRequest,
} from "./types/shipment.js";
export {
  assertProviderConformance,
  type ProviderConformanceOptions,
} from "./contracts/provider-contract.js";
export { validateQuoteRequest } from "./validation/shipment.js";
export {
  compileMappingDocumentToRecords,
  isLocationError,
  LocationError,
  LocationValidationError,
  MIN_RESOLUTION_SCORE,
  normalizeCountryCode,
  normalizeLocationToken,
  normalizePostalCode,
  pickBestScoredCandidates,
  resolveLocation,
  resolveLocationOrNull,
  scoreLocationCandidates,
  scoreLocationRecord,
  validateLocationInput,
  type CoordinateInput,
  type LocationErrorCode,
  type LocationInput,
  type LocationInputUnion,
  type LocationMethodInput,
  type LocationPathSnapshot,
  type LocationResolution,
  type LocationResolverOptions,
  type ProviderLocationLevel,
  type ProviderLocationMappingCountry,
  type ProviderLocationMappingDocument,
  type ProviderLocationMappingNode,
  type ProviderLocationRecord,
  type ScoredLocationRecord,
} from "./location/index.js";
