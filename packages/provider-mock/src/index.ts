import type {
  ProviderCapabilities,
  Quote,
  QuoteRequest,
  ShippingProvider,
} from "@ongkirhub/core";

function routeSeed(request: QuoteRequest): number {
  const origin = request.origin.city ?? request.origin.province ?? "origin";
  const destination =
    request.destination.city ?? request.destination.province ?? "destination";
  const raw = `${origin}:${destination}:${request.totalWeightGrams}`;
  let hash = 0;
  for (const char of raw) {
    hash = (hash * 31 + char.charCodeAt(0)) % 10_000;
  }
  return hash;
}

export function createMockProvider(): ShippingProvider {
  const capabilities: ProviderCapabilities = {
    coverage: ["domestic"],
    dimensionsRequired: false,
    codSupported: false,
    serviceFilteringSupported: false,
  };

  return {
    key: "mock",
    name: "Mock Provider",
    capabilities,
    async getQuotes(request: QuoteRequest): Promise<Quote[]> {
      const seed = routeSeed(request);
      const weightFactor = Math.ceil(request.totalWeightGrams / 1000);

      return [
        {
          providerKey: "mock",
          serviceCode: "MOCK_REG",
          serviceName: "Mock Regular",
          price: {
            amount: 10_000 + (seed % 5_000) + weightFactor * 2_000,
            currency: "IDR",
          },
          estimatedDuration: { value: 2 + (seed % 3), unit: "days" },
          notes: "Deterministic mock quote for development",
        },
        {
          providerKey: "mock",
          serviceCode: "MOCK_EXP",
          serviceName: "Mock Express",
          price: {
            amount: 20_000 + (seed % 7_000) + weightFactor * 3_000,
            currency: "IDR",
          },
          estimatedDuration: { value: 1, unit: "days" },
          metadata: { tier: "express", seed },
        },
      ];
    },
  };
}

export const mockProvider = createMockProvider();
