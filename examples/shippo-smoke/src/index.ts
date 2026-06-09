import { createOngkirHub } from "@ongkirhub/runtime";
import {
  createShippoProvider,
  requireShippoConfigFromEnv,
} from "@ongkirhub/provider-shippo";

const shippoConfig = requireShippoConfigFromEnv(process.env);

const shippoProvider = createShippoProvider({
  apiKey: shippoConfig.apiKey,
  carriers: shippoConfig.carriers,
  ...(shippoConfig.baseUrl ? { baseUrl: shippoConfig.baseUrl } : {}),
  debug: shippoConfig.debug,
});

const hub = createOngkirHub({
  providers: [shippoProvider],
});

async function main() {
  console.log("=== OngkirHub Shippo Smoke ===\n");
  console.log("Note: Shippo test mode returns placeholder/sample rates.");
  console.log("      This example is for integration validation, not real-price validation.\n");

  // 1. Health check
  const health = hub.getHealth();
  console.log("Health:", health);
  console.log();

  // 2. Get quotes — US domestic route
  const request = {
    origin: {
      method: "location" as const,
      countryCode: "US",
      postalCode: "90210",
      level1: "CA",
      level2: "Beverly Hills",
    },
    destination: {
      method: "location" as const,
      countryCode: "US",
      postalCode: "10001",
      level1: "NY",
      level2: "New York",
    },
    parcels: [
      {
        weightGrams: 1500,
        dimensions: { lengthCm: 25, widthCm: 20, heightCm: 15 },
      },
    ],
    totalWeightGrams: 1500,
  };

  try {
    const { quotes, providers } = await hub.getQuotes(request);
    console.log(`Providers: ${providers.join(", ") || "none"}`);
    console.log(`Quotes returned: ${quotes.length}`);
    for (const quote of quotes) {
      console.log(
        `  ${quote.serviceName} (${quote.providerKey}) — ${quote.price.amount.toLocaleString()} ${quote.price.currency}`,
      );
    }
  } catch (error) {
    console.error("Quote fetch failed:", error);
  }
}

main();
