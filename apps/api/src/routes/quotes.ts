import { isProviderError, validateQuoteRequest } from "@ongkirhub/core";
import type { OngkirHub } from "@ongkirhub/runtime";
import type { Hono } from "hono";
import { quoteRequestSchema } from "../schemas/quote-request.js";
import type { QuotesResponseBody } from "../schemas/quote-response.js";

export function registerQuotesRoute(
  app: Hono,
  hub: OngkirHub,
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

    let quoteRequest;
    try {
      quoteRequest = validateQuoteRequest(shipment);
    } catch (error) {
      if (isProviderError(error) && error.code === "INVALID_REQUEST") {
        return context.json({ error: error.message }, 400);
      }
      throw error;
    }

    const providerKeys = requestedProviders
      ? Array.isArray(requestedProviders)
        ? requestedProviders
        : [requestedProviders]
      : undefined;

    try {
      const result = await hub.getQuotes(quoteRequest, {
        providers: providerKeys,
      });

      const response: QuotesResponseBody = {
        quotes: result.quotes,
        providers: result.providers,
        requestSummary: {
          origin: quoteRequest.origin,
          destination: quoteRequest.destination,
        },
        ...(result.debug ? { debug: result.debug } : {}),
      };

      return context.json(response);
    } catch (error) {
      if (
        isProviderError(error) &&
        error.code === "INVALID_REQUEST" &&
        error.message === "No providers configured"
      ) {
        return context.json(
          { error: error.message, code: error.code },
          503,
        );
      }

      if (isProviderError(error) && error.code === "INVALID_REQUEST") {
        return context.json(
          { error: error.message, code: error.code },
          400,
        );
      }

      if (isProviderError(error)) {
        return context.json(
          {
            error: error.message,
            code: error.code,
            providerKey: error.providerKey,
          },
          502,
        );
      }

      throw error;
    }
  });
}
