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
import { RAJAONGKIR_PROVIDER_KEY, resolveDistrict } from "./location/resolve.js";
import { mapRajaOngkirCostsToQuotes } from "./quotes.js";

export function createRajaOngkirProvider(
  config: RajaOngkirProviderConfig,
): ShippingProvider {
  const validated = validateRajaOngkirProviderConfig(config);
  const client = new RajaOngkirClient({
    apiKey: validated.apiKey,
    baseUrl: validated.baseUrl,
  });

  const capabilities: ProviderCapabilities = {
    coverage: ["domestic"],
    dimensionsRequired: false,
    codSupported: false,
    serviceFilteringSupported: false,
  };

  return {
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

      const costs = await client.calculateDistrictDomesticCost({
        originDistrictId: origin.providerId,
        destinationDistrictId: destination.providerId,
        weightGrams: request.totalWeightGrams,
        couriers: validated.couriers,
      });

      return mapRajaOngkirCostsToQuotes(costs);
    },
  };
}
