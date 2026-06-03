import { ProviderError } from "@ongkirhub/core";

export const DEFAULT_BITESHIP_BASE_URL = "https://api.biteship.com";

export interface BiteshipProviderConfig {
  apiKey: string;
  baseUrl?: string;
  couriers: string[];
  debug?: boolean;
}

export function validateBiteshipProviderConfig(
  config: BiteshipProviderConfig,
): Required<Pick<BiteshipProviderConfig, "baseUrl">> & BiteshipProviderConfig {
  if (!config.apiKey?.trim()) {
    throw new ProviderError(
      "INVALID_PROVIDER_CONFIG",
      "Biteship provider requires apiKey",
      { providerKey: "biteship" },
    );
  }

  if (!config.couriers?.length) {
    throw new ProviderError(
      "INVALID_PROVIDER_CONFIG",
      "Biteship provider requires at least one courier",
      { providerKey: "biteship" },
    );
  }

  return {
    ...config,
    apiKey: config.apiKey.trim(),
    baseUrl: config.baseUrl?.trim() || DEFAULT_BITESHIP_BASE_URL,
    couriers: config.couriers.map((c) => c.trim()).filter(Boolean),
  };
}
