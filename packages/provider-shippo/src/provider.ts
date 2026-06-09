import {
  ProviderError,
  type ProviderCapabilities,
  type Quote,
  type QuoteRequest,
  type ShippingProvider,
} from "@ongkirhub/core";
import { ShippoClient } from "./client.js";
import {
  type ShippoProviderConfig,
  validateShippoProviderConfig,
} from "./config.js";
import { SHIPPO_PROVIDER_KEY, mapShippoRatesToQuotes } from "./quotes.js";

export interface ShippoProvider extends ShippingProvider {
  getDebugInfo?(): object;
}

function toShippoAddress(location: QuoteRequest["origin"]) {
  return {
    country: location.countryCode,
    zip: location.postalCode,
    state: location.level1,
    city: location.level2,
  };
}

export function createShippoProvider(
  config: ShippoProviderConfig,
): ShippoProvider {
  const validated = validateShippoProviderConfig(config);
  const client = new ShippoClient({
    apiKey: validated.apiKey,
    baseUrl: validated.baseUrl,
    debug: validated.debug,
  });

  const capabilities: ProviderCapabilities = {
    coverage: ["domestic"],
    dimensionsRequired: true,
    codSupported: false,
    serviceFilteringSupported: true,
  };

  let lastDebugInfo: object | undefined;

  const provider: ShippoProvider = {
    key: SHIPPO_PROVIDER_KEY,
    name: "Shippo",
    capabilities,
    async getQuotes(request: QuoteRequest): Promise<Quote[]> {
      if (request.origin.countryCode !== request.destination.countryCode) {
        throw new ProviderError(
          "UNSUPPORTED_ROUTE",
          "Shippo alpha only supports domestic (same-country) shipments",
          { providerKey: SHIPPO_PROVIDER_KEY },
        );
      }

      const originPostalCode = request.origin.postalCode?.trim();
      const destinationPostalCode = request.destination.postalCode?.trim();

      if (!originPostalCode) {
        throw new ProviderError(
          "LOCATION_NOT_FOUND",
          "Shippo requires origin postal code",
          { providerKey: SHIPPO_PROVIDER_KEY },
        );
      }

      if (!destinationPostalCode) {
        throw new ProviderError(
          "LOCATION_NOT_FOUND",
          "Shippo requires destination postal code",
          { providerKey: SHIPPO_PROVIDER_KEY },
        );
      }

      const dimensions = request.parcels[0]?.dimensions;
      if (!dimensions) {
        throw new ProviderError(
          "INVALID_REQUEST",
          "Shippo alpha requires parcel dimensions (lengthCm, widthCm, heightCm)",
          { providerKey: SHIPPO_PROVIDER_KEY },
        );
      }

      const parcel = {
        weight: request.totalWeightGrams,
        mass_unit: "g" as const,
        length: dimensions.lengthCm,
        width: dimensions.widthCm,
        height: dimensions.heightCm,
        distance_unit: "cm" as const,
      };

      const fromAddress = toShippoAddress(request.origin);
      const toAddress = toShippoAddress(request.destination);

      if (validated.debug) {
        lastDebugInfo = {
          originPostalCode,
          destinationPostalCode,
          fromAddress,
          toAddress,
          weightGrams: parcel.weight,
          carriers: validated.carriers,
        };
      }

      const shipment = await client.createShipment({
        fromAddress,
        toAddress,
        parcel,
      });

      const quotes = mapShippoRatesToQuotes(shipment.rates, {
        carrierFilter: validated.carriers.length > 0 ? validated.carriers : undefined,
      });

      if (
        validated.carriers.length > 0 &&
        quotes.length === 0 &&
        shipment.rates.length > 0
      ) {
        // Rates were returned, but none matched the requested carriers.
        // This usually means the requested carrier names do not match accounts
        // configured in Shippo, or the filter is misconfigured.
        throw new ProviderError(
          "UNKNOWN_PROVIDER_FAILURE",
          `Shippo returned no rates for requested carriers: ${validated.carriers.join(", ")}. Check carrier account configuration.`,
          { providerKey: SHIPPO_PROVIDER_KEY },
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
