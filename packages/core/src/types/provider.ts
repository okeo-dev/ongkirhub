import type { ProviderCapabilities } from "./capabilities.js";
import type { Quote } from "./quote.js";
import type { QuoteRequest } from "./shipment.js";

export interface ShippingProvider {
  readonly key: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  getQuotes(request: QuoteRequest): Promise<Quote[]>;
}
