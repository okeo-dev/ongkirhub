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
  console.log("=== OngkirHub Shippo International Smoke ===\n");
  console.log("Note: This is an alpha path.");
  console.log("      International quotes use the shared request.items[] array.");
  console.log("      Provider-specific flags use metadata.shippo.\n");
  console.log("      Inline customs_declaration has been live-validated for this alpha path.\n");

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
      shippo: {
        originLine1: "123 Sunset Blvd",
        destinationLine1: "10 Downing St",
        originPhone: "+1-555-0100",
        destinationPhone: "+44-20-7946-0958",
        certify: true,
        certifySigner: "Jane Doe",
        contentsType: "MERCHANDISE",
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
      console.log(`  Duration: ${quote.estimatedDuration?.value} ${quote.estimatedDuration?.unit}`);
      console.log();
    }

    console.log("✅ Inline customs_declaration accepted — international probe succeeded.");
  } catch (error) {
    console.error("❌ Quote fetch failed:", error);

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "UPSTREAM_UNAVAILABLE"
    ) {
      console.error(
        "\nProbe result: Inconclusive — Shippo did not return a usable upstream response.",
      );
      console.error(
        "This run does not tell us whether inline customs_declaration is accepted.",
      );
    } else {
      console.error(
        "\nProbe result: Inline customs_declaration was rejected or failed at the application layer.",
      );
      console.error(
        "This may mean Shippo requires separate customs item/declaration creation or another request-shape correction.",
      );
    }
  }
}

main();
