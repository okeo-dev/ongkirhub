import type { ShippingProvider } from "@ongkirhub/core";

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
