import { useEffect, useMemo, useState } from "react";
import { createOngkirHub } from "@ongkirhub/runtime";
import { mockProvider } from "@ongkirhub/provider-mock";
import { defaultManualProvider } from "@ongkirhub/provider-manual";
import { OngkirHubProvider, useOngkirHub } from "@ongkirhub/react";
import type { ShippingProvider } from "@ongkirhub/core";
import { createRajaOngkirProvider } from "../../../packages/provider-rajaongkir/dist/provider.js";
import { RAJAONGKIR_LOCATION_RECORDS } from "../../../packages/provider-rajaongkir/dist/location/generated/locations.generated.js";
import { createBiteshipProvider } from "../../../packages/provider-biteship/dist/provider.js";

function DemoWarning() {
  return (
    <div style={{ background: "#dc3545", color: "white", padding: "12px 16px", borderRadius: "4px", marginBottom: "16px" }}>
      <strong>⚠️ DEMO ONLY — NOT PRODUCTION SAFE</strong>
      <div style={{ fontSize: "14px", marginTop: "4px" }}>
        This demo runs providers directly in the browser. API keys entered here are exposed to the client.
        In production, keep providers and secrets on the server behind an OngkirHub runtime or HTTP boundary.
      </div>
    </div>
  );
}

function ProviderConfig({
  onProvidersChange,
}: {
  onProvidersChange: (providers: ShippingProvider[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(["mock"]);
  const [rajaKey, setRajaKey] = useState("");
  const [rajaCouriers, setRajaCouriers] = useState("jne,pos");
  const [biteKey, setBiteKey] = useState("");
  const [biteCouriers, setBiteCouriers] = useState("jne,sicepat");

  const providers = useMemo(() => {
    const list: ShippingProvider[] = [];
    if (selected.includes("mock")) list.push(mockProvider);
    if (selected.includes("manual")) list.push(defaultManualProvider);
    if (selected.includes("rajaongkir") && rajaKey.trim()) {
      list.push(
        createRajaOngkirProvider({
          apiKey: rajaKey.trim(),
          couriers: rajaCouriers.split(",").map((c) => c.trim()),
          records: RAJAONGKIR_LOCATION_RECORDS,
        }),
      );
    }
    if (selected.includes("biteship") && biteKey.trim()) {
      list.push(
        createBiteshipProvider({
          apiKey: biteKey.trim(),
          couriers: biteCouriers.split(",").map((c) => c.trim()),
        }),
      );
    }
    return list;
  }, [selected, rajaKey, rajaCouriers, biteKey, biteCouriers]);

  useEffect(() => {
    onProvidersChange(providers);
  }, [providers, onProvidersChange]);

  return (
    <div style={{ marginBottom: "16px" }}>
      <h3>Providers</h3>
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        {["mock", "manual", "rajaongkir", "biteship"].map((key) => (
          <label key={key} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <input
              type="checkbox"
              checked={selected.includes(key)}
              onChange={(e) => {
                setSelected((prev) =>
                  e.target.checked ? [...prev, key] : prev.filter((k) => k !== key),
                );
              }}
            />
            {key}
          </label>
        ))}
      </div>

      {selected.includes("rajaongkir") && (
        <div style={{ marginTop: "8px" }}>
          <input
            type="text"
            placeholder="RajaOngkir API Key"
            value={rajaKey}
            onChange={(e) => setRajaKey(e.target.value)}
            style={{ width: "100%", padding: "8px", marginBottom: "4px" }}
          />
          <input
            type="text"
            placeholder="Couriers (comma-separated)"
            value={rajaCouriers}
            onChange={(e) => setRajaCouriers(e.target.value)}
            style={{ width: "100%", padding: "8px" }}
          />
        </div>
      )}

      {selected.includes("biteship") && (
        <div style={{ marginTop: "8px" }}>
          <input
            type="text"
            placeholder="Biteship API Key"
            value={biteKey}
            onChange={(e) => setBiteKey(e.target.value)}
            style={{ width: "100%", padding: "8px", marginBottom: "4px" }}
          />
          <input
            type="text"
            placeholder="Couriers (comma-separated)"
            value={biteCouriers}
            onChange={(e) => setBiteCouriers(e.target.value)}
            style={{ width: "100%", padding: "8px" }}
          />
        </div>
      )}
    </div>
  );
}

function QuotePanel() {
  const hub = useOngkirHub();
  const [quotes, setQuotes] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedProviders = hub.getHealth().providers;

  const fetchQuotes = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await hub.getQuotes({
        origin: {
          method: "location",
          countryCode: "ID",
          postalCode: "11460",
          level1: "DKI Jakarta",
          level2: "Jakarta Barat",
          level3: "Grogol Petamburan",
          level4: "Jelambar",
        },
        destination: {
          method: "location",
          countryCode: "ID",
          postalCode: "60281",
          level1: "Jawa Timur",
          level2: "Surabaya",
          level3: "Gubeng",
          level4: "Airlangga",
        },
        parcels: [{ weightGrams: 1500 }],
        totalWeightGrams: 1500,
      });
      setQuotes(result.quotes);
    } catch (err: any) {
      const message = err?.message ?? "Failed to fetch quotes";
      const isBrowserNetworkFailure =
        message === "Load failed" || message === "Failed to fetch";
      const includesRajaOngkir = selectedProviders.includes("rajaongkir");

      if (isBrowserNetworkFailure && includesRajaOngkir) {
        setError(
          "RajaOngkir blocks direct browser requests due to CORS. Use a server-side OngkirHub runtime or HTTP boundary for RajaOngkir.",
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={fetchQuotes} disabled={loading} style={{ padding: "8px 16px" }}>
        {loading ? "Loading..." : "Get Quotes"}
      </button>

      {error && <div style={{ color: "#dc3545", marginTop: "8px" }}>Error: {error}</div>}

      {quotes && (
        <div style={{ marginTop: "16px" }}>
          <h4>Quotes ({quotes.length})</h4>
          {quotes.map((q, i) => (
            <div key={i} style={{ border: "1px solid #ddd", padding: "8px", marginBottom: "4px", borderRadius: "4px" }}>
              <strong>{q.serviceName}</strong> ({q.providerKey}) — {q.price.amount.toLocaleString()} {q.price.currency}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthPanel() {
  const hub = useOngkirHub();
  const health = hub.getHealth();
  return (
    <div style={{ marginBottom: "16px", color: "#666" }}>
      Health: {health.status} | Providers: {health.providers.join(", ") || "none"}
    </div>
  );
}

export default function App() {
  const [providers, setProviders] = useState<ShippingProvider[]>([mockProvider]);
  const hub = useMemo(() => createOngkirHub({ providers }), [providers]);

  return (
    <div style={{ maxWidth: "640px", margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1>OngkirHub Runtime Demo</h1>
      <DemoWarning />
      <OngkirHubProvider hub={hub}>
        <HealthPanel />
        <ProviderConfig onProvidersChange={setProviders} />
        <QuotePanel />
      </OngkirHubProvider>
    </div>
  );
}
