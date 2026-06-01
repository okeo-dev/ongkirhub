import type { ShippingProvider } from "@ongkirhub/core";
import type { Hono } from "hono";
import { listProviderKeys } from "../registry/providers.js";

export function registerHealthRoute(
  app: Hono,
  options: {
    version: string;
    registry: Map<string, ShippingProvider>;
  },
): void {
  app.get("/health", (context) => {
    return context.json({
      status: "ok",
      version: options.version,
      providers: listProviderKeys(options.registry),
    });
  });
}
