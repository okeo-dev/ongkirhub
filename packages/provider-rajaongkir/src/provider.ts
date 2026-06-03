import {
  ProviderError,
  type ProviderCapabilities,
  type Quote,
  type QuoteRequest,
  type ShippingProvider,
} from "@ongkirhub/core";
import { RajaOngkirClient } from "./client.js";
import {
  type RajaOngkirProviderConfig,
  validateRajaOngkirProviderConfig,
} from "./config.js";
import {
  RAJAONGKIR_PROVIDER_KEY,
  extractRajaOngkirApiId,
  resolveDistrict,
} from "./location/resolve.js";
import { mapRajaOngkirCostsToQuotes } from "./quotes.js";

export interface RajaOngkirProvider extends ShippingProvider {
  getDebugInfo?(): object;
}

export function createRajaOngkirProvider(
  config: RajaOngkirProviderConfig,
): RajaOngkirProvider {
  const validated = validateRajaOngkirProviderConfig(config);
  const client = new RajaOngkirClient({
    apiKey: validated.apiKey,
    baseUrl: validated.baseUrl,
    debug: validated.debug,
  });

  const capabilities: ProviderCapabilities = {
    coverage: ["domestic"],
    dimensionsRequired: false,
    codSupported: false,
    serviceFilteringSupported: false,
  };

  let lastDebugInfo: object | undefined;

  const provider: RajaOngkirProvider = {
    key: RAJAONGKIR_PROVIDER_KEY,
    name: "RajaOngkir",
    capabilities,
    async getQuotes(request: QuoteRequest): Promise<Quote[]> {
      if (request.origin.countryCode !== "ID" || request.destination.countryCode !== "ID") {
        throw new ProviderError(
          "UNSUPPORTED_ROUTE",
          "RajaOngkir v0.1 only supports domestic Indonesia routes",
          { providerKey: RAJAONGKIR_PROVIDER_KEY },
        );
      }

      const origin = resolveDistrict(request.origin, validated.records);
      const destination = resolveDistrict(
        request.destination,
        validated.records,
      );

      const originId = extractRajaOngkirApiId(origin.providerId);
      const destinationId = extractRajaOngkirApiId(destination.providerId);

      if (validated.debug) {
        lastDebugInfo = {
          originId,
          destinationId,
          weightGrams: request.totalWeightGrams,
          couriers: validated.couriers,
        };
      }

      const costs = await client.calculateDomesticCost({
        originId,
        destinationId,
        weightGrams: request.totalWeightGrams,
        couriers: validated.couriers,
      });

      return mapRajaOngkirCostsToQuotes(costs);
    },
  };

  if (validated.debug) {
    provider.getDebugInfo = () => lastDebugInfo ?? {};
  }

  return provider;
}
