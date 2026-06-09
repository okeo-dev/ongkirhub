import { ProviderError } from "@ongkirhub/core";

export const DEFAULT_EASYPOST_BASE_URL = "https://api.easypost.com/v2";

export interface EasyPostEnvConfig {
  apiKey: string;
  carriers: string[];
  baseUrl?: string;
  debug?: boolean;
}

export interface EasyPostProviderConfig extends EasyPostEnvConfig {}

function parseCarrierList(value: string | undefined): string[] {
  if (!value || value.trim() === "") {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function loadEasyPostConfigFromEnv(
  env: NodeJS.ProcessEnv,
): EasyPostEnvConfig | undefined {
  const apiKey = env.EASYPOST_API_KEY?.trim();
  const carriers = parseCarrierList(env.EASYPOST_CARRIERS);
  const baseUrl = env.EASYPOST_BASE_URL?.trim();
  const debug = env.EASYPOST_DEBUG === "1" || env.EASYPOST_DEBUG === "true";

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

export function requireEasyPostConfigFromEnv(
  env: NodeJS.ProcessEnv,
): EasyPostEnvConfig {
  const apiKey = env.EASYPOST_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "EASYPOST_API_KEY is required when easypost is enabled in ENABLED_PROVIDERS",
    );
  }

  const carriers = parseCarrierList(env.EASYPOST_CARRIERS);
  const baseUrl = env.EASYPOST_BASE_URL?.trim();
  const debug = env.EASYPOST_DEBUG === "1" || env.EASYPOST_DEBUG === "true";

  return {
    apiKey,
    carriers,
    debug,
    ...(baseUrl ? { baseUrl } : {}),
  };
}

export function validateEasyPostProviderConfig(
  config: EasyPostProviderConfig,
): Required<Pick<EasyPostProviderConfig, "baseUrl">> & EasyPostProviderConfig {
  if (!config.apiKey?.trim()) {
    throw new ProviderError(
      "INVALID_PROVIDER_CONFIG",
      "EasyPost provider requires apiKey",
      { providerKey: "easypost" },
    );
  }

  return {
    ...config,
    apiKey: config.apiKey.trim(),
    baseUrl: config.baseUrl?.trim() || DEFAULT_EASYPOST_BASE_URL,
    carriers: config.carriers.map((c) => c.trim()).filter(Boolean),
  };
}
