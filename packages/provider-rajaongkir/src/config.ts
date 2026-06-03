import { ProviderError, type ProviderLocationRecord } from "@ongkirhub/core";

export const DEFAULT_RAJAONGKIR_BASE_URL =
  "https://rajaongkir.komerce.id/api/v1";

export interface RajaOngkirEnvConfig {
  apiKey: string;
  couriers: string[];
  internationalCouriers?: string[];
  baseUrl?: string;
  debug?: boolean;
  unsafeAllowAmbiguousBestMatch?: boolean;
}

export interface RajaOngkirProviderConfig extends RajaOngkirEnvConfig {
  records: ProviderLocationRecord[];
}

function parseCourierList(value: string | undefined): string[] {
  if (!value || value.trim() === "") {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function loadRajaOngkirConfigFromEnv(
  env: NodeJS.ProcessEnv,
): RajaOngkirEnvConfig | undefined {
  const apiKey = env.RAJAONGKIR_API_KEY?.trim();
  const couriers = parseCourierList(env.RAJAONGKIR_COURIERS);
  const internationalCouriers = parseCourierList(env.RAJAONGKIR_INTERNATIONAL_COURIERS);
  const baseUrl = env.RAJAONGKIR_BASE_URL?.trim();
  const debug = env.RAJAONGKIR_DEBUG === "1" || env.RAJAONGKIR_DEBUG === "true";
  const unsafeAllowAmbiguousBestMatch = env.RAJAONGKIR_UNSAFE_ALLOW_AMBIGUOUS_BEST_MATCH === "1";

  if (!apiKey && couriers.length === 0 && !baseUrl && !unsafeAllowAmbiguousBestMatch) {
    return undefined;
  }

  return {
    apiKey: apiKey ?? "",
    couriers,
    ...(internationalCouriers.length > 0 ? { internationalCouriers } : {}),
    debug,
    ...(unsafeAllowAmbiguousBestMatch ? { unsafeAllowAmbiguousBestMatch } : {}),
    ...(baseUrl ? { baseUrl } : {}),
  };
}

export function requireRajaOngkirConfigFromEnv(
  env: NodeJS.ProcessEnv,
): RajaOngkirEnvConfig {
  const apiKey = env.RAJAONGKIR_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "RAJAONGKIR_API_KEY is required when rajaongkir is enabled in ENABLED_PROVIDERS",
    );
  }

  const couriers = parseCourierList(env.RAJAONGKIR_COURIERS);
  if (couriers.length === 0) {
    throw new Error(
      "RAJAONGKIR_COURIERS is required when rajaongkir is enabled in ENABLED_PROVIDERS",
    );
  }

  const internationalCouriers = parseCourierList(env.RAJAONGKIR_INTERNATIONAL_COURIERS);
  const baseUrl = env.RAJAONGKIR_BASE_URL?.trim();
  const debug = env.RAJAONGKIR_DEBUG === "1" || env.RAJAONGKIR_DEBUG === "true";
  const unsafeAllowAmbiguousBestMatch = env.RAJAONGKIR_UNSAFE_ALLOW_AMBIGUOUS_BEST_MATCH === "1";

  return {
    apiKey,
    couriers,
    ...(internationalCouriers.length > 0 ? { internationalCouriers } : {}),
    debug,
    ...(unsafeAllowAmbiguousBestMatch ? { unsafeAllowAmbiguousBestMatch } : {}),
    ...(baseUrl ? { baseUrl } : {}),
  };
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
