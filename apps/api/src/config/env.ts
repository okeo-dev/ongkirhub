import type { BiteshipEnvConfig } from "@ongkirhub/provider-biteship";
import {
  loadBiteshipConfigFromEnv,
  requireBiteshipConfigFromEnv,
} from "@ongkirhub/provider-biteship";
import type { EasyPostEnvConfig } from "@ongkirhub/provider-easypost";
import {
  loadEasyPostConfigFromEnv,
  requireEasyPostConfigFromEnv,
} from "@ongkirhub/provider-easypost";
import type { ShippoEnvConfig } from "@ongkirhub/provider-shippo";
import {
  loadShippoConfigFromEnv,
  requireShippoConfigFromEnv,
} from "@ongkirhub/provider-shippo";
import type { EasyshipEnvConfig } from "@ongkirhub/provider-easyship";
import {
  loadEasyshipConfigFromEnv,
  requireEasyshipConfigFromEnv,
} from "@ongkirhub/provider-easyship";
import type { RajaOngkirEnvConfig } from "@ongkirhub/provider-rajaongkir";
import {
  loadRajaOngkirConfigFromEnv,
  requireRajaOngkirConfigFromEnv,
} from "@ongkirhub/provider-rajaongkir";

export interface ApiEnv {
  port: number;
  host: string;
  enabledProviders: string[];
  rajaongkir?: RajaOngkirEnvConfig;
  biteship?: BiteshipEnvConfig;
  easypost?: EasyPostEnvConfig;
  shippo?: ShippoEnvConfig;
  easyship?: EasyshipEnvConfig;
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
    ? requireRajaOngkirConfigFromEnv(env)
    : loadRajaOngkirConfigFromEnv(env);

  const biteshipEnabled = enabledProviders.includes("biteship");
  const biteship = biteshipEnabled
    ? requireBiteshipConfigFromEnv(env)
    : loadBiteshipConfigFromEnv(env);

  const easypostEnabled = enabledProviders.includes("easypost");
  const easypost = easypostEnabled
    ? requireEasyPostConfigFromEnv(env)
    : loadEasyPostConfigFromEnv(env);

  const shippoEnabled = enabledProviders.includes("shippo");
  const shippo = shippoEnabled
    ? requireShippoConfigFromEnv(env)
    : loadShippoConfigFromEnv(env);

  const easyshipEnabled = enabledProviders.includes("easyship");
  const easyship = easyshipEnabled
    ? requireEasyshipConfigFromEnv(env)
    : loadEasyshipConfigFromEnv(env);

  return {
    port,
    host: env.HOST ?? "0.0.0.0",
    enabledProviders,
    ...(rajaongkir ? { rajaongkir } : {}),
    ...(biteship ? { biteship } : {}),
    ...(easypost ? { easypost } : {}),
    ...(shippo ? { shippo } : {}),
    ...(easyship ? { easyship } : {}),
  };
}
