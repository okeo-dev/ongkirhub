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
import { resolveCountryId } from "./location/country-resolve.js";
import {
  RAJAONGKIR_PROVIDER_KEY,
  extractRajaOngkirApiId,
  resolveDistrict,
} from "./location/resolve.js";
import {
  mapRajaOngkirCostsToQuotes,
  mapRajaOngkirInternationalCostsToQuotes,
} from "./quotes.js";

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
    coverage: ["domestic", "international"],
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
      if (request.origin.countryCode !== "ID") {
        throw new ProviderError(
          "UNSUPPORTED_ROUTE",
          "RajaOngkir only supports Indonesia-origin shipments",
          { providerKey: RAJAONGKIR_PROVIDER_KEY },
        );
      }

      const isDomestic = request.destination.countryCode === "ID";

      if (isDomestic) {
        return handleDomestic(request);
      }

      return handleInternational(request);
    },
  };

  async function handleDomestic(request: QuoteRequest): Promise<Quote[]> {
    const origin = resolveDistrict(request.origin, validated.records);
    const destination = resolveDistrict(
      request.destination,
      validated.records,
    );

    const originId = extractRajaOngkirApiId(origin.providerId);
    const destinationId = extractRajaOngkirApiId(destination.providerId);

    if (validated.debug) {
      lastDebugInfo = {
        route: "domestic",
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
  }

  async function handleInternational(request: QuoteRequest): Promise<Quote[]> {
    const origin = resolveDistrict(request.origin, validated.records);
    const originId = extractRajaOngkirApiId(origin.providerId);

    const countryRecord = resolveCountryId(request.destination.countryCode);

    const internationalCouriers = validated.internationalCouriers ?? validated.couriers;

    if (validated.debug) {
      lastDebugInfo = {
        route: "international",
        originId,
        destinationCountryId: countryRecord.providerId,
        destinationCountryCode: countryRecord.countryCode,
        weightGrams: request.totalWeightGrams,
        couriers: internationalCouriers,
      };
    }

    const costs = await client.calculateInternationalCost({
      originId,
      destinationCountryId: countryRecord.providerId,
      weightGrams: request.totalWeightGrams,
      couriers: internationalCouriers,
    });

    return mapRajaOngkirInternationalCostsToQuotes(costs);
  }

  if (validated.debug) {
    provider.getDebugInfo = () => lastDebugInfo ?? {};
  }

  return provider;
}
