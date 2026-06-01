import {
  ProviderError,
  type Duration,
  type ProviderCapabilities,
  type Quote,
  type QuoteRequest,
  type ShippingProvider,
} from "@ongkirhub/core";

export interface ManualServiceRate {
  serviceCode: string;
  serviceName: string;
  basePrice: number;
  currency: string;
  estimatedDuration: Duration;
  pricePerKg?: number;
  notes?: string;
}

export interface ManualProviderConfig {
  key?: string;
  name?: string;
  services: ManualServiceRate[];
  capabilities?: Partial<ProviderCapabilities>;
}

function calculatePrice(
  service: ManualServiceRate,
  totalWeightGrams: number,
): number {
  const weightKg = Math.max(1, Math.ceil(totalWeightGrams / 1000));
  const perKg =
    service.pricePerKg !== undefined ? service.pricePerKg * weightKg : 0;
  return service.basePrice + perKg;
}

export function createManualProvider(
  config: ManualProviderConfig,
): ShippingProvider {
  if (!config.services.length) {
    throw new ProviderError(
      "INVALID_PROVIDER_CONFIG",
      "Manual provider requires at least one service rate",
    );
  }

  const capabilities: ProviderCapabilities = {
    coverage: config.capabilities?.coverage ?? ["domestic"],
    dimensionsRequired: config.capabilities?.dimensionsRequired ?? false,
    codSupported: config.capabilities?.codSupported ?? false,
    serviceFilteringSupported:
      config.capabilities?.serviceFilteringSupported ?? true,
  };

  const providerKey = config.key ?? "manual";

  return {
    key: providerKey,
    name: config.name ?? "Manual Provider",
    capabilities,
    async getQuotes(request: QuoteRequest): Promise<Quote[]> {
      return config.services.map((service) => ({
        providerKey,
        serviceCode: service.serviceCode,
        serviceName: service.serviceName,
        price: {
          amount: calculatePrice(service, request.totalWeightGrams),
          currency: service.currency,
        },
        estimatedDuration: service.estimatedDuration,
        notes: service.notes,
        metadata: {
          source: "manual",
          weightKg: Math.ceil(request.totalWeightGrams / 1000),
        },
      }));
    },
  };
}

export const defaultManualProvider = createManualProvider({
  services: [
    {
      serviceCode: "MANUAL_REG",
      serviceName: "Manual Regular",
      basePrice: 12000,
      currency: "IDR",
      pricePerKg: 3000,
      estimatedDuration: { value: 3, unit: "days" },
    },
    {
      serviceCode: "MANUAL_EXP",
      serviceName: "Manual Express",
      basePrice: 25000,
      currency: "IDR",
      pricePerKg: 5000,
      estimatedDuration: { value: 1, unit: "days" },
    },
  ],
});
