import { createOngkirHub } from "@ongkirhub/runtime";
import { mockProvider } from "@ongkirhub/provider-mock";
import { defaultManualProvider } from "@ongkirhub/provider-manual";

const hub = createOngkirHub({
  providers: [mockProvider, defaultManualProvider],
});

async function main() {
  console.log("=== OngkirHub Runtime Smoke ===\n");

  // 1. Health check
  const health = hub.getHealth();
  console.log("Health:", health);
  console.log();

  // 2. Get quotes — domestic Indonesia route with full hierarchy
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
