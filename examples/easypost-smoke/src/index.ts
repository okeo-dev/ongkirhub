import { createOngkirHub } from "@ongkirhub/runtime";
import {
  createEasyPostProvider,
  requireEasyPostConfigFromEnv,
} from "@ongkirhub/provider-easypost";

const easyPostConfig = requireEasyPostConfigFromEnv(process.env);

const easyPostProvider = createEasyPostProvider({
  apiKey: easyPostConfig.apiKey,
  carriers: easyPostConfig.carriers,
  ...(easyPostConfig.baseUrl ? { baseUrl: easyPostConfig.baseUrl } : {}),
  debug: easyPostConfig.debug,
});

const hub = createOngkirHub({
  providers: [easyPostProvider],
});

async function main() {
  console.log("=== OngkirHub EasyPost Smoke ===\n");

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
    parcels: [{ weightGrams: 1500 }],
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
