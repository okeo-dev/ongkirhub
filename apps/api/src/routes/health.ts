import type { OngkirHub } from "@ongkirhub/runtime";
import type { Hono } from "hono";

export function registerHealthRoute(
  app: Hono,
  options: {
    version: string;
    hub: OngkirHub;
  },
): void {
  app.get("/health", (context) => {
    const health = options.hub.getHealth();
    return context.json({
      ...health,
      version: options.version,
    });
  });
}
