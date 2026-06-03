import type { ShippingProvider } from "@ongkirhub/core";
import { createBiteshipProvider } from "@ongkirhub/provider-biteship";
import { defaultManualProvider } from "@ongkirhub/provider-manual";
import { mockProvider } from "@ongkirhub/provider-mock";
import {
  createRajaOngkirProvider,
  RAJAONGKIR_LOCATION_RECORDS,
} from "@ongkirhub/provider-rajaongkir";
import type { ApiEnv } from "../config/env.js";

export const BUILT_IN_PROVIDER_KEYS = ["mock", "manual", "rajaongkir", "biteship"] as const;

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

    registry.set(key, staticProviders[key as keyof typeof staticProviders]);
  }

  return registry;
}

export function listProviderKeys(registry: Map<string, ShippingProvider>): string[] {
  return [...registry.keys()].sort();
}

export function resolveProviders(
  registry: Map<string, ShippingProvider>,
  requested?: string | string[],
): ShippingProvider[] {
  if (!requested) {
    return [...registry.values()];
  }

  const keys = Array.isArray(requested) ? requested : [requested];
  const providers: ShippingProvider[] = [];

  for (const key of keys) {
    const provider = registry.get(key);
    if (!provider) {
      throw new Error(`Unknown provider: ${key}`);
    }
    providers.push(provider);
  }

  return providers;
}
