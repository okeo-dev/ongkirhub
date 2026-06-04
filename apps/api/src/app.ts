import { Hono } from "hono";
import type { ShippingProvider } from "@ongkirhub/core";
import { createOngkirHub, type OngkirHub } from "@ongkirhub/runtime";
import type { ApiEnv } from "./config/env.js";
import { createProviderRegistry } from "./registry/providers.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerQuotesRoute } from "./routes/quotes.js";

export type ProviderRegistry = Map<string, ShippingProvider>;

export function createApp(options: {
  env: ApiEnv;
  version?: string;
  registry?: ProviderRegistry;
  hub?: OngkirHub;
}): Hono {
  const hub =
    options.hub ??
    createOngkirHub({
      providers: [...(options.registry ?? createProviderRegistry(options.env)).values()],
    });
  const version = options.version ?? "0.1.0";

  const app = new Hono();

  registerHealthRoute(app, {
    version,
    hub,
  });
  registerQuotesRoute(app, hub);

  return app;
}
