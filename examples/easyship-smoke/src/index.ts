import { createOngkirHub } from "@ongkirhub/runtime";
import {
  createEasyshipProvider,
  requireEasyshipConfigFromEnv,
} from "@ongkirhub/provider-easyship";

const easyshipConfig = requireEasyshipConfigFromEnv(process.env);

const easyshipProvider = createEasyshipProvider({
  apiKey: easyshipConfig.apiKey,
  carriers: easyshipConfig.carriers,
  ...(easyshipConfig.baseUrl ? { baseUrl: easyshipConfig.baseUrl } : {}),
  debug: easyshipConfig.debug,
});

const hub = createOngkirHub({
  providers: [easyshipProvider],
});

async function main() {
  console.log("=== OngkirHub Easyship Smoke ===\n");
  console.log("Note: Easyship alpha is domestic-only.");
  console.log("      International and customs support is intentionally deferred.\n");

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
      postalCode: "10118",
      level1: "NY",
      level2: "New York",
    },
    parcels: [
      {
        weightGrams: 1000,
        dimensions: { lengthCm: 10, widthCm: 10, heightCm: 1 },
      },
    ],
    totalWeightGrams: 1000,
    metadata: {
      easyship: {
        destinationLine1: "350 5th Ave",
        hsCode: "49011000",
        setAsResidential: false,
        calculateTaxAndDuties: true,
        incoterms: "DDU",
      },
    },
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
