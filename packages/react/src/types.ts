import type {
  OngkirHubClient,
  Quote,
  QuotesResponseBody,
  OngkirHubError,
} from "@ongkirhub/client";

export type { OngkirHubClient, Quote, QuotesResponseBody, OngkirHubError };

export interface UseShippingQuotesResult {
  quotes: Quote[] | undefined;
  providers: string[] | undefined;
  requestSummary: QuotesResponseBody["requestSummary"] | undefined;
  isIdle: boolean;
  isLoading: boolean;
  isSuccess: boolean;
  error: OngkirHubError | null;
  refetch: () => void;
}

export interface UseShippingQuotesOptions {
  enabled?: boolean;
}
