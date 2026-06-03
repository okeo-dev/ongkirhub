import { useState } from "react";
import { useShippingQuotes } from "@ongkirhub/react";
import type { QuoteRequest } from "@ongkirhub/client";

const ROUTE_A: QuoteRequest = {
  origin: {
    method: "location",
    countryCode: "ID",
    level1: "DKI Jakarta",
    level2: "Jakarta Barat",
    level3: "Grogol Petamburan",
    level4: "Jelambar",
  },
  destination: {
    method: "location",
    countryCode: "ID",
    level1: "Jawa Timur",
    level2: "Surabaya",
    level3: "Gubeng",
    level4: "Airlangga",
  },
  parcels: [{ weightGrams: 1500 }],
  totalWeightGrams: 1500,
};

const ROUTE_B: QuoteRequest = {
  origin: {
    method: "location",
    countryCode: "ID",
    level1: "Nusa Tenggara Barat (NTB)",
    level2: "Mataram",
    level3: "Mataram",
    level4: "Mataram Timur",
  },
  destination: {
    method: "location",
    countryCode: "ID",
    level1: "Nusa Tenggara Barat (NTB)",
    level2: "Mataram",
    level3: "Ampenan",
    level4: "Ampenan Selatan",
  },
  parcels: [{ weightGrams: 2000 }],
  totalWeightGrams: 2000,
};

const INVALID: QuoteRequest = {
  origin: { method: "location", countryCode: "ID" },
  destination: { method: "location", countryCode: "ID" },
  parcels: [{ weightGrams: 1000 }],
  totalWeightGrams: 1000,
};

export function App() {
  const [request, setRequest] = useState<QuoteRequest>(ROUTE_A);
  const { quotes, isLoading, isSuccess, error, refetch } = useShippingQuotes(request);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 600, margin: "40px auto", padding: 20 }}>
      <h1>OngkirHub React Demo</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => setRequest(ROUTE_A)}>Route A: Jakarta → Surabaya</button>
        <button onClick={() => setRequest(ROUTE_B)}>Route B: Mataram → Ampenan</button>
        <button onClick={() => setRequest(INVALID)}>Invalid request</button>
        <button onClick={refetch}>Refetch current</button>
      </div>

      {isLoading && <p>Loading…</p>}

      {error && (
        <div style={{ padding: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, color: "#991b1b" }}>
          <strong>Error:</strong> {error.message}
        </div>
      )}

      {isSuccess && (
        <div>
          <h2>Quotes ({quotes?.length ?? 0})</h2>
          {quotes?.length === 0 ? (
            <p>No shipping options found.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {quotes?.map((q, i) => (
                <li
                  key={`${q.providerKey}-${q.serviceCode}-${i}`}
                  style={{
                    padding: 12,
                    marginBottom: 8,
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    background: "#f9fafb",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {q.serviceName} ({q.providerKey})
                  </div>
                  <div style={{ fontSize: 14, color: "#6b7280" }}>
                    {q.price.amount.toLocaleString()} {q.price.currency}
                    {q.estimatedDuration
                      ? ` · ${q.estimatedDuration.value} ${q.estimatedDuration.unit}`
                      : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
