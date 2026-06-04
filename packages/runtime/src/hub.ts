import {
  isProviderError,
  ProviderError,
  validateQuoteRequest,
  type Quote,
  type QuoteRequest,
  type ShippingProvider,
} from "@ongkirhub/core";
import { resolveProviders } from "./registry.js";

export interface OngkirHub {
  getQuotes(
    request: QuoteRequest,
    options?: { providers?: string[] },
  ): Promise<{
    quotes: Quote[];
    providers: string[];
    debug?: Record<string, object>;
  }>;

  getHealth(): {
    status: "ok";
    providers: string[];
  };
}

export interface OngkirHubOptions {
  providers: ShippingProvider[];
}

export function createOngkirHub(options: OngkirHubOptions): OngkirHub {
  const registry = new Map<string, ShippingProvider>();
  for (const provider of options.providers) {
    registry.set(provider.key, provider);
  }

  return {
    async getQuotes(request, options) {
      const selectedProviders = resolveProviders(registry, options?.providers);

      if (selectedProviders.length === 0) {
        throw new ProviderError("INVALID_REQUEST", "No providers configured");
      }

      const quotes: Quote[] = [];
      for (const provider of selectedProviders) {
        try {
          const providerQuotes = await provider.getQuotes(request);
          quotes.push(...providerQuotes);
        } catch (error) {
          if (isProviderError(error)) {
            throw error;
          }
          throw error;
        }
      }

      const debug: Record<string, object> = {};
      for (const provider of selectedProviders) {
        const maybeDebug = (provider as unknown as Record<string, unknown>).getDebugInfo;
        if (typeof maybeDebug === "function") {
          const info = (maybeDebug as () => object)();
          if (info && Object.keys(info).length > 0) {
            debug[provider.key] = info;
          }
        }
      }

      return {
        quotes,
        providers: selectedProviders.map((provider) => provider.key),
        ...(Object.keys(debug).length > 0 ? { debug } : {}),
      };
    },

    getHealth() {
      return {
        status: "ok",
        providers: [...registry.keys()].sort(),
      };
    },
  };
}
