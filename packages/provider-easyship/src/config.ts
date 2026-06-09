import { ProviderError } from "@ongkirhub/core";

export const DEFAULT_EASYSHIP_BASE_URL = "https://public-api.easyship.com";

export interface EasyshipEnvConfig {
  apiKey: string;
  carriers: string[];
  baseUrl?: string;
  debug?: boolean;
}

export interface EasyshipProviderConfig extends EasyshipEnvConfig {}

function parseCarrierList(value: string | undefined): string[] {
  if (!value || value.trim() === "") {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function loadEasyshipConfigFromEnv(
  env: NodeJS.ProcessEnv,
): EasyshipEnvConfig | undefined {
  const apiKey = env.EASYSHIP_API_KEY?.trim();
  const carriers = parseCarrierList(env.EASYSHIP_CARRIERS);
  const baseUrl = env.EASYSHIP_BASE_URL?.trim();
  const debug = env.EASYSHIP_DEBUG === "1" || env.EASYSHIP_DEBUG === "true";

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

export function requireEasyshipConfigFromEnv(
  env: NodeJS.ProcessEnv,
): EasyshipEnvConfig {
  const apiKey = env.EASYSHIP_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "EASYSHIP_API_KEY is required when easyship is enabled in ENABLED_PROVIDERS",
    );
  }

  const carriers = parseCarrierList(env.EASYSHIP_CARRIERS);
  const baseUrl = env.EASYSHIP_BASE_URL?.trim();
  const debug = env.EASYSHIP_DEBUG === "1" || env.EASYSHIP_DEBUG === "true";

  return {
    apiKey,
    carriers,
    debug,
    ...(baseUrl ? { baseUrl } : {}),
  };
}

export function validateEasyshipProviderConfig(
  config: EasyshipProviderConfig,
): Required<Pick<EasyshipProviderConfig, "baseUrl">> & EasyshipProviderConfig {
  if (!config.apiKey?.trim()) {
    throw new ProviderError(
      "INVALID_PROVIDER_CONFIG",
      "Easyship provider requires apiKey",
      { providerKey: "easyship" },
    );
  }

  return {
    ...config,
    apiKey: config.apiKey.trim(),
    baseUrl: config.baseUrl?.trim() || DEFAULT_EASYSHIP_BASE_URL,
    carriers: config.carriers.map((c) => c.trim()).filter(Boolean),
  };
}
