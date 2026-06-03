import {
  isProviderError,
  validateQuoteRequest,
  type Quote,
  type ShippingProvider,
} from "@ongkirhub/core";
import type { Hono } from "hono";
import { resolveProviders } from "../registry/providers.js";
import { quoteRequestSchema } from "../schemas/quote-request.js";
import type { QuotesResponseBody } from "../schemas/quote-response.js";

export function registerQuotesRoute(
  app: Hono,
  registry: Map<string, ShippingProvider>,
): void {
  app.post("/v0/quotes", async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = quoteRequestSchema.safeParse(body);
    if (!parsed.success) {
      return context.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten(),
        },
        400,
      );
    }

    const { providers: requestedProviders, ...shipment } = parsed.data;

    let selectedProviders: ShippingProvider[];
    try {
      selectedProviders = resolveProviders(registry, requestedProviders);
    } catch (error) {
      return context.json(
        {
          error: error instanceof Error ? error.message : "Invalid providers",
        },
        400,
      );
    }

    if (selectedProviders.length === 0) {
      return context.json({ error: "No providers configured" }, 503);
    }

    let quoteRequest;
    try {
      quoteRequest = validateQuoteRequest(shipment);
    } catch (error) {
      if (isProviderError(error) && error.code === "INVALID_REQUEST") {
        return context.json({ error: error.message }, 400);
      }
      throw error;
    }

    const quotes: Quote[] = [];

    for (const provider of selectedProviders) {
      try {
        const providerQuotes = await provider.getQuotes(quoteRequest);
        quotes.push(...providerQuotes);
      } catch (error) {
        if (isProviderError(error)) {
          return context.json(
            {
              error: error.message,
              code: error.code,
              providerKey: error.providerKey ?? provider.key,
            },
            502,
          );
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

    const response: QuotesResponseBody = {
      quotes,
      providers: selectedProviders.map((provider) => provider.key),
      requestSummary: {
        origin: quoteRequest.origin,
        destination: quoteRequest.destination,
      },
      ...(Object.keys(debug).length > 0 ? { debug } : {}),
    };

    return context.json(response);
  });
}
