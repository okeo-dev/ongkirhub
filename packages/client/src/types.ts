import type {
  LocationMethodInput,
  Quote,
  QuoteRequest,
} from "@ongkirhub/core";

export type { QuoteRequest, Quote, LocationMethodInput };

/**
 * Origin summary as returned by the API.
 * Always strictly validated (postalCode or level1+level2 required).
 */
export type OriginSummary = LocationMethodInput;

/**
 * Destination summary as returned by the API.
 * May be countryCode-only for international routes.
 */
export interface DestinationSummary {
  method: "location";
  countryCode: string;
  postalCode?: string;
  level1?: string;
  level2?: string;
  level3?: string;
  level4?: string;
}

export interface QuotesResponseBody {
  quotes: Quote[];
  providers: string[];
  requestSummary: {
    origin: OriginSummary;
    destination: DestinationSummary;
  };
  debug?: Record<string, object>;
}

export interface HealthResponseBody {
  status: string;
  version: string;
  providers: string[];
}

export interface OngkirHubClientConfig {
  baseUrl: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}
