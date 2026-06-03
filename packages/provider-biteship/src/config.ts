import { ProviderError } from "@ongkirhub/core";

export const DEFAULT_BITESHIP_BASE_URL = "https://api.biteship.com";

export interface BiteshipEnvConfig {
  apiKey: string;
  couriers: string[];
  baseUrl?: string;
  debug?: boolean;
}

export interface BiteshipProviderConfig extends BiteshipEnvConfig {}

function parseCourierList(value: string | undefined): string[] {
  if (!value || value.trim() === "") {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function loadBiteshipConfigFromEnv(
  env: NodeJS.ProcessEnv,
): BiteshipEnvConfig | undefined {
  const apiKey = env.BITESHIP_API_KEY?.trim();
  const couriers = parseCourierList(env.BITESHIP_COURIERS);
  const baseUrl = env.BITESHIP_BASE_URL?.trim();
  const debug = env.BITESHIP_DEBUG === "1" || env.BITESHIP_DEBUG === "true";

  if (!apiKey && couriers.length === 0 && !baseUrl) {
    return undefined;
  }

  return {
    apiKey: apiKey ?? "",
    couriers,
    debug,
    ...(baseUrl ? { baseUrl } : {}),
  };
}

export function requireBiteshipConfigFromEnv(
  env: NodeJS.ProcessEnv,
): BiteshipEnvConfig {
  const apiKey = env.BITESHIP_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "BITESHIP_API_KEY is required when biteship is enabled in ENABLED_PROVIDERS",
    );
  }

  const couriers = parseCourierList(env.BITESHIP_COURIERS);
  if (couriers.length === 0) {
    throw new Error(
      "BITESHIP_COURIERS is required when biteship is enabled in ENABLED_PROVIDERS",
    );
  }

  const baseUrl = env.BITESHIP_BASE_URL?.trim();
  const debug = env.BITESHIP_DEBUG === "1" || env.BITESHIP_DEBUG === "true";

  return {
    apiKey,
    couriers,
    debug,
    ...(baseUrl ? { baseUrl } : {}),
  };
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
