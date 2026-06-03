import type { Quote, LocationMethodInput } from "@ongkirhub/core";

export interface QuotesResponseBody {
  quotes: Quote[];
  providers: string[];
  requestSummary: {
    origin: LocationMethodInput;
    destination: LocationMethodInput;
  };
  debug?: Record<string, object>;
}
