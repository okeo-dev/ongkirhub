export interface RajaOngkirEnvConfig {
  apiKey: string;
  couriers: string[];
  internationalCouriers?: string[];
  baseUrl?: string;
  debug?: boolean;
}

export interface BiteshipEnvConfig {
  apiKey: string;
  couriers: string[];
  baseUrl?: string;
  debug?: boolean;
}

export interface ApiEnv {
  port: number;
  host: string;
  enabledProviders: string[];
  rajaongkir?: RajaOngkirEnvConfig;
  biteship?: BiteshipEnvConfig;
}

function parseProviderList(value: string | undefined): string[] {
  if (!value || value.trim() === "") {
    return ["mock", "manual"];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
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

function loadRajaOngkirConfig(
  env: NodeJS.ProcessEnv,
): RajaOngkirEnvConfig | undefined {
  const apiKey = env.RAJAONGKIR_API_KEY?.trim();
  const couriers = parseCourierList(env.RAJAONGKIR_COURIERS);
  const internationalCouriers = parseCourierList(env.RAJAONGKIR_INTERNATIONAL_COURIERS);
  const baseUrl = env.RAJAONGKIR_BASE_URL?.trim();
  const debug = env.RAJAONGKIR_DEBUG === "1" || env.RAJAONGKIR_DEBUG === "true";

  if (!apiKey && couriers.length === 0 && !baseUrl) {
    return undefined;
  }

  return {
    apiKey: apiKey ?? "",
    couriers,
    ...(internationalCouriers.length > 0 ? { internationalCouriers } : {}),
    debug,
    ...(baseUrl ? { baseUrl } : {}),
  };
}

function requireRajaOngkirConfig(
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
  return {
    apiKey,
    couriers,
    ...(internationalCouriers.length > 0 ? { internationalCouriers } : {}),
    debug,
    ...(baseUrl ? { baseUrl } : {}),
  };
}

function loadBiteshipConfig(
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

function requireBiteshipConfig(
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

export function loadEnv(
  env: NodeJS.ProcessEnv = process.env,
): ApiEnv {
  const port = Number(env.PORT ?? "3000");
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("PORT must be a positive number");
  }

  const enabledProviders = parseProviderList(env.ENABLED_PROVIDERS);
  const rajaongkirEnabled = enabledProviders.includes("rajaongkir");
  const rajaongkir = rajaongkirEnabled
    ? requireRajaOngkirConfig(env)
    : loadRajaOngkirConfig(env);

  const biteshipEnabled = enabledProviders.includes("biteship");
  const biteship = biteshipEnabled
    ? requireBiteshipConfig(env)
    : loadBiteshipConfig(env);

  return {
    port,
    host: env.HOST ?? "0.0.0.0",
    enabledProviders,
    ...(rajaongkir ? { rajaongkir } : {}),
    ...(biteship ? { biteship } : {}),
  };
}
