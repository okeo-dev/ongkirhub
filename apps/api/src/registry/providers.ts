import type { ShippingProvider } from "@ongkirhub/core";
import { defaultManualProvider } from "@ongkirhub/provider-manual";
import { mockProvider } from "@ongkirhub/provider-mock";

export const BUILT_IN_PROVIDER_KEYS = ["mock", "manual"] as const;

const builtInProviders: Record<
  (typeof BUILT_IN_PROVIDER_KEYS)[number],
  ShippingProvider
> = {
  mock: mockProvider,
  manual: defaultManualProvider,
};

export function createProviderRegistry(
  enabledKeys: string[],
): Map<string, ShippingProvider> {
  const unknownKeys = enabledKeys.filter(
    (key) => !Object.hasOwn(builtInProviders, key),
  );
  if (unknownKeys.length > 0) {
    throw new Error(
      `Unknown provider key(s) in ENABLED_PROVIDERS: ${unknownKeys.join(", ")}`,
    );
  }

  const registry = new Map<string, ShippingProvider>();

  for (const key of enabledKeys) {
    registry.set(key, builtInProviders[key as keyof typeof builtInProviders]);
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
