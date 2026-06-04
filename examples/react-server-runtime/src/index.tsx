import { createOngkirHub } from "@ongkirhub/runtime";
import { mockProvider } from "@ongkirhub/provider-mock";
import { defaultManualProvider } from "@ongkirhub/provider-manual";
import React from "react";
import { renderToString } from "react-dom/server";

const hub = createOngkirHub({
  providers: [mockProvider, defaultManualProvider],
});

interface QuoteCardProps {
  providerKey: string;
  serviceName: string;
  price: { amount: number; currency: string };
  estimatedDuration?: { value: number; unit: string };
}

function QuoteCard({ providerKey, serviceName, price, estimatedDuration }: QuoteCardProps) {
  return (
    <div style={{ border: "1px solid #ddd", padding: "12px", marginBottom: "8px", borderRadius: "4px" }}>
      <strong>{serviceName}</strong> <span style={{ color: "#666" }}>({providerKey})</span>
      <div style={{ marginTop: "4px" }}>
        {price.amount.toLocaleString()} {price.currency}
        {estimatedDuration && (
          <span style={{ marginLeft: "8px", color: "#666" }}>
            — {estimatedDuration.value} {estimatedDuration.unit}
          </span>
        )}
      </div>
    </div>
  );
}

interface QuotePageProps {
  quotes: QuoteCardProps[];
  providers: string[];
}

function QuotePage({ quotes, providers }: QuotePageProps) {
  return (
    <html>
      <head>
        <title>Shipping Quotes</title>
      </head>
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: "600px", margin: "40px auto", padding: "0 16px" }}>
        <h1>Shipping Quotes</h1>
        <p>Providers: {providers.join(", ")}</p>
        <div>
          {quotes.map((quote, index) => (
            <QuoteCard key={index} {...quote} />
          ))}
        </div>
        <p style={{ color: "#666", fontSize: "14px", marginTop: "24px" }}>
          Rendered server-side with @ongkirhub/runtime — no HTTP server involved.
        </p>
      </body>
    </html>
  );
}

async function main() {
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

  const { quotes, providers } = await hub.getQuotes(request);

  const html = renderToString(
    <QuotePage quotes={quotes} providers={providers} />,
  );

  console.log("<!DOCTYPE html>");
  console.log(html);
}

main().catch(console.error);
