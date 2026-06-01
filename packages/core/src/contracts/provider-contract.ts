import type { ShippingProvider } from "../types/provider.js";
import type { QuoteRequest } from "../types/shipment.js";
import { validateQuoteRequest } from "../validation/shipment.js";

export interface ProviderConformanceOptions {
  sampleRequest?: QuoteRequest;
}

const defaultSampleRequest: QuoteRequest = {
  origin: {
    method: "location",
    countryCode: "ID",
    level1: "DKI Jakarta",
    level2: "Jakarta Pusat",
  },
  destination: {
    method: "location",
    countryCode: "ID",
    level1: "Jawa Barat",
    level2: "Bandung",
  },
  parcels: [{ weightGrams: 1000 }],
  totalWeightGrams: 1000,
};

export async function assertProviderConformance(
  provider: ShippingProvider,
  options: ProviderConformanceOptions = {},
): Promise<void> {
  if (!provider.key || typeof provider.key !== "string") {
    throw new Error("Provider must expose a non-empty string key");
  }
  if (!provider.name || typeof provider.name !== "string") {
    throw new Error("Provider must expose a non-empty string name");
  }
  if (!provider.capabilities || typeof provider.capabilities !== "object") {
    throw new Error("Provider must declare capabilities");
  }
  if (typeof provider.getQuotes !== "function") {
    throw new Error("Provider must implement getQuotes");
  }

  const request = options.sampleRequest ?? defaultSampleRequest;
  validateQuoteRequest(request);

  const quotes = await provider.getQuotes(request);

  if (!Array.isArray(quotes)) {
    throw new Error("getQuotes must return an array");
  }

  for (const quote of quotes) {
    if (quote.providerKey !== provider.key) {
      throw new Error(
        `Quote providerKey "${quote.providerKey}" must match provider key "${provider.key}"`,
      );
    }
    if (!quote.serviceCode || !quote.serviceName) {
      throw new Error("Each quote must include serviceCode and serviceName");
    }
    if (
      typeof quote.price?.amount !== "number" ||
      !quote.price.currency ||
      typeof quote.estimatedDuration?.value !== "number" ||
      !quote.estimatedDuration.unit
    ) {
      throw new Error("Each quote must include price and estimatedDuration");
    }
  }
}
