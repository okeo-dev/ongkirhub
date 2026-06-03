import {
  ProviderError,
  type ProviderCapabilities,
  type Quote,
  type QuoteRequest,
  type ShippingProvider,
} from "@ongkirhub/core";
import { BiteshipClient } from "./client.js";
import {
  type BiteshipProviderConfig,
  validateBiteshipProviderConfig,
} from "./config.js";
import { BITESHIP_PROVIDER_KEY, mapBiteshipPricingToQuotes } from "./quotes.js";

export interface BiteshipProvider extends ShippingProvider {
  getDebugInfo?(): object;
}

export function createBiteshipProvider(
  config: BiteshipProviderConfig,
): BiteshipProvider {
  const validated = validateBiteshipProviderConfig(config);
  const client = new BiteshipClient({
    apiKey: validated.apiKey,
    baseUrl: validated.baseUrl,
    debug: validated.debug,
  });

  const capabilities: ProviderCapabilities = {
    coverage: ["domestic"],
    dimensionsRequired: false,
    codSupported: true,
    serviceFilteringSupported: false,
  };

  let lastDebugInfo: object | undefined;

  const provider: BiteshipProvider = {
    key: BITESHIP_PROVIDER_KEY,
    name: "Biteship",
    capabilities,
    async getQuotes(request: QuoteRequest): Promise<Quote[]> {
      if (request.origin.countryCode !== "ID" || request.destination.countryCode !== "ID") {
        throw new ProviderError(
          "UNSUPPORTED_ROUTE",
          "Biteship v0.1 only supports domestic Indonesia routes",
          { providerKey: BITESHIP_PROVIDER_KEY },
        );
      }

      const originPostalCode = request.origin.postalCode?.trim();
      const destinationPostalCode = request.destination.postalCode?.trim();

      if (!originPostalCode) {
        throw new ProviderError(
          "LOCATION_NOT_FOUND",
          "Biteship requires origin postal code",
          { providerKey: BITESHIP_PROVIDER_KEY },
        );
      }

      if (!destinationPostalCode) {
        throw new ProviderError(
          "LOCATION_NOT_FOUND",
          "Biteship requires destination postal code",
          { providerKey: BITESHIP_PROVIDER_KEY },
        );
      }

      const items = request.parcels.map((parcel) => ({
        name: "Parcel",
        weight: parcel.weightGrams,
        ...(parcel.dimensions
          ? {
              length: parcel.dimensions.lengthCm,
              width: parcel.dimensions.widthCm,
              height: parcel.dimensions.heightCm,
            }
          : {}),
        ...(parcel.quantity ? { quantity: parcel.quantity } : {}),
      }));

      if (validated.debug) {
        lastDebugInfo = {
          originPostalCode,
          destinationPostalCode,
          weightGrams: items.reduce((sum, item) => sum + (item.weight ?? 0), 0),
          couriers: validated.couriers,
          items,
        };
      }

      const pricing = await client.getRates({
        originPostalCode,
        destinationPostalCode,
        couriers: validated.couriers,
        items,
      });

      return mapBiteshipPricingToQuotes(pricing);
    },
  };

  if (validated.debug) {
    provider.getDebugInfo = () => lastDebugInfo ?? {};
  }

  return provider;
}
