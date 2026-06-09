import { ProviderError } from "@ongkirhub/core";

export const DEFAULT_SHIPPO_BASE_URL = "https://api.goshippo.com";

export interface ShippoEnvConfig {
  apiKey: string;
  carriers: string[];
  baseUrl?: string;
  debug?: boolean;
}

export interface ShippoProviderConfig extends ShippoEnvConfig {}

function parseCarrierList(value: string | undefined): string[] {
  if (!value || value.trim() === "") {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function loadShippoConfigFromEnv(
  env: NodeJS.ProcessEnv,
): ShippoEnvConfig | undefined {
  const apiKey = env.SHIPPO_API_KEY?.trim();
  const carriers = parseCarrierList(env.SHIPPO_CARRIERS);
  const baseUrl = env.SHIPPO_BASE_URL?.trim();
  const debug = env.SHIPPO_DEBUG === "1" || env.SHIPPO_DEBUG === "true";

  if (!apiKey && carriers.length === 0 && !baseUrl) {
    return undefined;
  }

  return {
    apiKey: apiKey ?? "",
    carriers,
    debug,
    ...(baseUrl ? { baseUrl } : {}),
  };
}

export function requireShippoConfigFromEnv(
  env: NodeJS.ProcessEnv,
): ShippoEnvConfig {
  const apiKey = env.SHIPPO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "SHIPPO_API_KEY is required when shippo is enabled in ENABLED_PROVIDERS",
    );
  }

  const carriers = parseCarrierList(env.SHIPPO_CARRIERS);
  const baseUrl = env.SHIPPO_BASE_URL?.trim();
  const debug = env.SHIPPO_DEBUG === "1" || env.SHIPPO_DEBUG === "true";

  return {
    apiKey,
    carriers,
    debug,
    ...(baseUrl ? { baseUrl } : {}),
  };
}

export function validateShippoProviderConfig(
  config: ShippoProviderConfig,
): Required<Pick<ShippoProviderConfig, "baseUrl">> & ShippoProviderConfig {
  if (!config.apiKey?.trim()) {
    throw new ProviderError(
      "INVALID_PROVIDER_CONFIG",
      "Shippo provider requires apiKey",
      { providerKey: "shippo" },
    );
  }

  return {
    ...config,
    apiKey: config.apiKey.trim(),
    baseUrl: config.baseUrl?.trim() || DEFAULT_SHIPPO_BASE_URL,
    carriers: config.carriers.map((c) => c.trim()).filter(Boolean),
  };
}
