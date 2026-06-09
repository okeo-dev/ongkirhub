import type { ShippingProvider } from "@ongkirhub/core";
import { createBiteshipProvider } from "@ongkirhub/provider-biteship";
import { createEasyPostProvider } from "@ongkirhub/provider-easypost";
import { createShippoProvider } from "@ongkirhub/provider-shippo";
import { createEasyshipProvider } from "@ongkirhub/provider-easyship";
import { defaultManualProvider } from "@ongkirhub/provider-manual";
import { mockProvider } from "@ongkirhub/provider-mock";
import {
  createRajaOngkirProvider,
  RAJAONGKIR_LOCATION_RECORDS,
} from "@ongkirhub/provider-rajaongkir";
import type { ApiEnv } from "../config/env.js";

export const BUILT_IN_PROVIDER_KEYS = ["mock", "manual", "rajaongkir", "biteship", "easypost", "shippo", "easyship"] as const;

const staticProviders: Record<"mock" | "manual", ShippingProvider> = {
  mock: mockProvider,
  manual: defaultManualProvider,
};

export function createProviderRegistry(env: ApiEnv): Map<string, ShippingProvider> {
  const { enabledProviders, rajaongkir } = env;
  const knownKeys = new Set<string>(BUILT_IN_PROVIDER_KEYS);
  const unknownKeys = enabledProviders.filter((key) => !knownKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(
      `Unknown provider key(s) in ENABLED_PROVIDERS: ${unknownKeys.join(", ")}`,
    );
  }

  if (enabledProviders.includes("rajaongkir") && !rajaongkir) {
    throw new Error(
      "RajaOngkir is enabled in ENABLED_PROVIDERS but RajaOngkir configuration is missing",
    );
  }

  if (enabledProviders.includes("biteship") && !env.biteship) {
    throw new Error(
      "Biteship is enabled in ENABLED_PROVIDERS but Biteship configuration is missing",
    );
  }

  if (enabledProviders.includes("easypost") && !env.easypost) {
    throw new Error(
      "EasyPost is enabled in ENABLED_PROVIDERS but EasyPost configuration is missing",
    );
  }

  if (enabledProviders.includes("shippo") && !env.shippo) {
    throw new Error(
      "Shippo is enabled in ENABLED_PROVIDERS but Shippo configuration is missing",
    );
  }

  if (enabledProviders.includes("easyship") && !env.easyship) {
    throw new Error(
      "Easyship is enabled in ENABLED_PROVIDERS but Easyship configuration is missing",
    );
  }

  const registry = new Map<string, ShippingProvider>();

  for (const key of enabledProviders) {
    if (key === "rajaongkir") {
      registry.set(
        key,
        createRajaOngkirProvider({
          apiKey: rajaongkir!.apiKey,
          couriers: rajaongkir!.couriers,
          ...(rajaongkir!.internationalCouriers
            ? { internationalCouriers: rajaongkir!.internationalCouriers }
            : {}),
          baseUrl: rajaongkir!.baseUrl,
          records: RAJAONGKIR_LOCATION_RECORDS,
          debug: rajaongkir!.debug,
          unsafeAllowAmbiguousBestMatch: rajaongkir!.unsafeAllowAmbiguousBestMatch,
        }),
      );
      continue;
    }

    if (key === "biteship") {
      registry.set(
        key,
        createBiteshipProvider({
          apiKey: env.biteship!.apiKey,
          couriers: env.biteship!.couriers,
          baseUrl: env.biteship!.baseUrl,
          debug: env.biteship!.debug,
        }),
      );
      continue;
    }

    if (key === "easypost") {
      registry.set(
        key,
        createEasyPostProvider({
          apiKey: env.easypost!.apiKey,
          carriers: env.easypost!.carriers,
          baseUrl: env.easypost!.baseUrl,
          debug: env.easypost!.debug,
        }),
      );
      continue;
    }

    if (key === "shippo") {
      registry.set(
        key,
        createShippoProvider({
          apiKey: env.shippo!.apiKey,
          carriers: env.shippo!.carriers,
          baseUrl: env.shippo!.baseUrl,
          debug: env.shippo!.debug,
        }),
      );
      continue;
    }

    if (key === "easyship") {
      registry.set(
        key,
        createEasyshipProvider({
          apiKey: env.easyship!.apiKey,
          carriers: env.easyship!.carriers,
          baseUrl: env.easyship!.baseUrl,
          debug: env.easyship!.debug,
        }),
      );
      continue;
    }

    registry.set(key, staticProviders[key as keyof typeof staticProviders]);
  }

  return registry;
}
