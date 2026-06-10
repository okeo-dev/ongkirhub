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
  console.log("=== OngkirHub Easyship International Smoke ===\n");
  console.log("Note: This is an alpha path.");
  console.log("      International quotes use the shared request.items[] array.");
  console.log("      Provider-specific flags (incoterms, duties) use metadata.easyship.\n");

  // 1. Health check
  const health = hub.getHealth();
  console.log("Health:", health);
  console.log();

  // 2. Get quotes — US to UK international route
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
      countryCode: "GB",
      postalCode: "SW1A 1AA",
      level1: "England",
      level2: "London",
    },
    parcels: [
      {
        weightGrams: 2000,
        dimensions: { lengthCm: 30, widthCm: 20, heightCm: 15 },
      },
    ],
    totalWeightGrams: 2000,
    items: [
      {
        description: "Organic loose-leaf tea",
        quantity: 3,
        weightGrams: 1500,
        declaredValue: { amount: 18.0, currency: "USD" },
        hsCode: "090210",
        originCountryCode: "US",
      },
      {
        description: "Ceramic teapot",
        quantity: 1,
        weightGrams: 500,
        declaredValue: { amount: 35.0, currency: "USD" },
        hsCode: "691200",
        originCountryCode: "US",
      },
    ],
    metadata: {
      easyship: {
        originLine1: "123 Sunset Blvd",
        destinationLine1: "10 Downing St",
        setAsResidential: false,
        calculateTaxAndDuties: true,
        incoterms: "DDU",
      },
    },
  };

  try {
    const { quotes, providers } = await hub.getQuotes(request);
    console.log(`Providers: ${providers.join(", ") || "none"}`);
    console.log(`Quotes returned: ${quotes.length}\n`);

    for (const quote of quotes) {
      console.log(
        `${quote.serviceName} (${quote.providerKey}) — ${quote.price.amount.toLocaleString()} ${quote.price.currency}`,
      );

      // Print international metadata when present
      const meta = quote.metadata as Record<string, unknown> | undefined;
      if (meta?.incoterm) {
        console.log(`  Incoterm: ${meta.incoterm}`);
      }
      if (meta?.taxAndDuty) {
        const td = meta.taxAndDuty as { total: number };
        console.log(`  Est. tax & duty: ${td.total.toLocaleString()}`);
      }
      if (meta?.insuranceFee) {
        console.log(`  Insurance: ${(meta.insuranceFee as number).toLocaleString()}`);
      }
      console.log();
    }
  } catch (error) {
    console.error("Quote fetch failed:", error);
  }
}

main();
