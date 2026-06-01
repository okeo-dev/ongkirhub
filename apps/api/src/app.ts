import { Hono } from "hono";
import type { ShippingProvider } from "@ongkirhub/core";
import type { ApiEnv } from "./config/env.js";
import { createProviderRegistry } from "./registry/providers.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerQuotesRoute } from "./routes/quotes.js";

export type ProviderRegistry = Map<string, ShippingProvider>;

export function createApp(options: {
  env: ApiEnv;
  version?: string;
  registry?: ProviderRegistry;
}): Hono {
  const registry =
    options.registry ?? createProviderRegistry(options.env.enabledProviders);
  const version = options.version ?? "0.1.0";

  const app = new Hono();

  registerHealthRoute(app, {
    version,
    registry,
  });
  registerQuotesRoute(app, registry);

  return app;
}
