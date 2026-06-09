import {
  ProviderError,
  type ProviderCapabilities,
  type Quote,
  type QuoteRequest,
  type ShippingProvider,
} from "@ongkirhub/core";
import { EasyPostClient } from "./client.js";
import {
  type EasyPostProviderConfig,
  validateEasyPostProviderConfig,
} from "./config.js";
import { EASYPOST_PROVIDER_KEY, mapEasyPostRatesToQuotes } from "./quotes.js";

export interface EasyPostProvider extends ShippingProvider {
  getDebugInfo?(): object;
}

function toEasyPostAddress(location: QuoteRequest["origin"]) {
  return {
    country: location.countryCode,
    zip: location.postalCode,
    state: location.level1,
    city: location.level2,
  };
}

function gramsToOunces(grams: number): number {
  return Math.round((grams / 28.3495) * 100) / 100;
}

function cmToInches(cm: number): number {
  return Math.round((cm / 2.54) * 100) / 100;
}

export function createEasyPostProvider(
  config: EasyPostProviderConfig,
): EasyPostProvider {
  const validated = validateEasyPostProviderConfig(config);
  const client = new EasyPostClient({
    apiKey: validated.apiKey,
    baseUrl: validated.baseUrl,
    debug: validated.debug,
  });

  const capabilities: ProviderCapabilities = {
    coverage: ["domestic"],
    dimensionsRequired: false,
    codSupported: false,
    serviceFilteringSupported: true,
  };

  let lastDebugInfo: object | undefined;

  const provider: EasyPostProvider = {
    key: EASYPOST_PROVIDER_KEY,
    name: "EasyPost",
    capabilities,
    async getQuotes(request: QuoteRequest): Promise<Quote[]> {
      if (request.origin.countryCode !== request.destination.countryCode) {
        throw new ProviderError(
          "UNSUPPORTED_ROUTE",
          "EasyPost alpha only supports domestic (same-country) shipments",
          { providerKey: EASYPOST_PROVIDER_KEY },
        );
      }

      const originPostalCode = request.origin.postalCode?.trim();
      const destinationPostalCode = request.destination.postalCode?.trim();

      if (!originPostalCode) {
        throw new ProviderError(
          "LOCATION_NOT_FOUND",
          "EasyPost requires origin postal code",
          { providerKey: EASYPOST_PROVIDER_KEY },
        );
      }

      if (!destinationPostalCode) {
        throw new ProviderError(
          "LOCATION_NOT_FOUND",
          "EasyPost requires destination postal code",
          { providerKey: EASYPOST_PROVIDER_KEY },
        );
      }

      const parcel: { weight: number; length?: number; width?: number; height?: number } = {
        weight: gramsToOunces(request.totalWeightGrams),
      };

      const dimensions = request.parcels[0]?.dimensions;
      if (dimensions) {
        parcel.length = cmToInches(dimensions.lengthCm);
        parcel.width = cmToInches(dimensions.widthCm);
        parcel.height = cmToInches(dimensions.heightCm);
      }

      const fromAddress = toEasyPostAddress(request.origin);
      const toAddress = toEasyPostAddress(request.destination);

      if (validated.debug) {
        lastDebugInfo = {
          originPostalCode,
          destinationPostalCode,
          fromAddress,
          toAddress,
          weightOunces: parcel.weight,
          carriers: validated.carriers,
        };
      }

      const shipment = await client.createShipment({
        fromAddress,
        toAddress,
        parcel,
      });

      const quotes = mapEasyPostRatesToQuotes(shipment.rates, {
        carrierFilter: validated.carriers.length > 0 ? validated.carriers : undefined,
      });

      if (
        validated.carriers.length > 0 &&
        quotes.length === 0 &&
        shipment.rates.length > 0
      ) {
        // Rates were returned, but none matched the requested carriers.
        // This usually means the requested carrier names do not match accounts
        // configured in EasyPost, or the filter is misconfigured.
        throw new ProviderError(
          "UNKNOWN_PROVIDER_FAILURE",
          `EasyPost returned no rates for requested carriers: ${validated.carriers.join(", ")}. Check carrier account configuration.`,
          { providerKey: EASYPOST_PROVIDER_KEY },
        );
      }

      return quotes;
    },
  };

  if (validated.debug) {
    provider.getDebugInfo = () => lastDebugInfo ?? {};
  }

  return provider;
}
