import { ProviderError, type ProviderLocationRecord } from "@ongkirhub/core";

export const DEFAULT_RAJAONGKIR_BASE_URL =
  "https://rajaongkir.komerce.id/api/v1";

export interface RajaOngkirProviderConfig {
  apiKey: string;
  baseUrl?: string;
  couriers: string[];
  records: ProviderLocationRecord[];
  debug?: boolean;
}

export function validateRajaOngkirProviderConfig(
  config: RajaOngkirProviderConfig,
): Required<Pick<RajaOngkirProviderConfig, "baseUrl">> &
  RajaOngkirProviderConfig {
  if (!config.apiKey?.trim()) {
    throw new ProviderError(
      "INVALID_PROVIDER_CONFIG",
      "RajaOngkir provider requires apiKey",
      { providerKey: "rajaongkir" },
    );
  }

  if (!config.couriers?.length) {
    throw new ProviderError(
      "INVALID_PROVIDER_CONFIG",
      "RajaOngkir provider requires at least one courier",
      { providerKey: "rajaongkir" },
    );
  }

  if (!config.records?.length) {
    throw new ProviderError(
      "INVALID_PROVIDER_CONFIG",
      "RajaOngkir provider requires location mapping records",
      { providerKey: "rajaongkir" },
    );
  }

  return {
    ...config,
    apiKey: config.apiKey.trim(),
    baseUrl: config.baseUrl?.trim() || DEFAULT_RAJAONGKIR_BASE_URL,
    couriers: config.couriers.map((courier) => courier.trim()).filter(Boolean),
  };
}
