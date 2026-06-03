import { OngkirHubClient } from "@ongkirhub/client";

const API_URL = process.env.ONGKIRHUB_API_URL ?? "http://localhost:3000";

const client = new OngkirHubClient({ baseUrl: API_URL });

async function main() {
  console.log(`API URL: ${API_URL}\n`);

  // 1. Health check
  try {
    const health = await client.getHealth();
    console.log("Health:", health);
  } catch (error) {
    console.error("Health check failed:", error);
  }

  console.log();

  // 2. Get quotes — domestic Indonesia route with full hierarchy
  // (postal-code-only can be ambiguous; level4 resolution is reliable)
  const request = {
    origin: {
      method: "location" as const,
      countryCode: "ID",
      level1: "DKI Jakarta",
      level2: "Jakarta Barat",
      level3: "Grogol Petamburan",
      level4: "Jelambar",
    },
    destination: {
      method: "location" as const,
      countryCode: "ID",
      level1: "Jawa Timur",
      level2: "Surabaya",
      level3: "Gubeng",
      level4: "Airlangga",
    },
    parcels: [{ weightGrams: 1500 }],
    totalWeightGrams: 1500,
  };

  try {
    const { quotes, providers, requestSummary } = await client.getQuotes(request);
    console.log(`Providers: ${providers.join(", ") || "none"}`);
    console.log(`Quotes returned: ${quotes.length}`);
    for (const quote of quotes) {
      console.log(
        `  ${quote.serviceName} (${quote.providerKey}) — ${quote.price.amount.toLocaleString()} ${quote.price.currency}`,
      );
    }
    console.log("\nRequest summary:", requestSummary);
  } catch (error) {
    console.error("Quote fetch failed:", error);
  }
}

main();
