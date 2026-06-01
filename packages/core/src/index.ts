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
  Address,
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
