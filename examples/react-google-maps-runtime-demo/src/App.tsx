import { useEffect, useMemo, useRef, useState } from "react";
import { createOngkirHub } from "@ongkirhub/runtime";
import { mockProvider } from "@ongkirhub/provider-mock";
import { defaultManualProvider } from "@ongkirhub/provider-manual";
import { OngkirHubProvider, useOngkirHub } from "@ongkirhub/react";
import type { LocationMethodInput, Quote, QuoteRequest, ShippingProvider } from "@ongkirhub/core";
import { loadGoogleMaps, attachAutocomplete, type NormalizedPlace } from "./google.js";
import { createRajaOngkirProvider, RAJAONGKIR_LOCATION_RECORDS } from "@ongkirhub/provider-rajaongkir";
import { createBiteshipProvider } from "@ongkirhub/provider-biteship";

function DemoWarning() {
  return (
    <div style={{ background: "#dc3545", color: "white", padding: "12px 16px", borderRadius: "4px", marginBottom: "16px" }}>
      <strong>⚠️ DEMO ONLY — NOT PRODUCTION SAFE</strong>
      <div style={{ fontSize: "14px", marginTop: "4px" }}>
        This demo runs providers directly in the browser with exposed API keys.
        In production, keep providers and secrets on the server behind an OngkirHub runtime or HTTP boundary.
      </div>
    </div>
  );
}

function ProviderSetup({ onProvidersChange }: { onProvidersChange: (p: ShippingProvider[]) => void }) {
  const [rajaKey, setRajaKey] = useState("");
  const [biteKey, setBiteKey] = useState("");

  const providers = useMemo(() => {
    const list: ShippingProvider[] = [mockProvider, defaultManualProvider];
    if (rajaKey.trim()) {
      list.push(createRajaOngkirProvider({ apiKey: rajaKey.trim(), couriers: ["jne", "pos"], records: RAJAONGKIR_LOCATION_RECORDS }));
    }
    if (biteKey.trim()) {
      list.push(createBiteshipProvider({ apiKey: biteKey.trim(), couriers: ["jne", "sicepat"] }));
    }
    return list;
  }, [rajaKey, biteKey]);

  useEffect(() => {
    onProvidersChange(providers);
  }, [providers, onProvidersChange]);

  return (
    <div style={{ marginBottom: "16px" }}>
      <h3>Provider Keys (optional)</h3>
      <input type="text" placeholder="RajaOngkir API Key" value={rajaKey} onChange={(e) => setRajaKey(e.target.value)} style={{ width: "100%", padding: "8px", marginBottom: "4px" }} />
      <input type="text" placeholder="Biteship API Key" value={biteKey} onChange={(e) => setBiteKey(e.target.value)} style={{ width: "100%", padding: "8px" }} />
    </div>
  );
}

function toHierarchyLocation(location: LocationMethodInput): LocationMethodInput {
  return {
    method: "location",
    countryCode: location.countryCode,
    ...(location.level1 ? { level1: location.level1 } : {}),
    ...(location.level2 ? { level2: location.level2 } : {}),
    ...(location.level3 ? { level3: location.level3 } : {}),
    ...(location.level4 ? { level4: location.level4 } : {}),
  };
}

function toPostalLocation(location: LocationMethodInput): LocationMethodInput {
  return {
    method: "location",
    countryCode: location.countryCode,
    ...(location.postalCode ? { postalCode: location.postalCode } : {}),
  };
}

function formatProviderError(error: any, selectedProviders: string[]): string {
  const message = error?.message ?? "Failed";
  const code = error?.code;
  const providerKey = error?.providerKey;
  const isBrowserNetworkFailure =
    message === "Load failed" || message === "Failed to fetch";
  const includesRajaOngkir = selectedProviders.includes("rajaongkir");

  if (isBrowserNetworkFailure && includesRajaOngkir) {
    return "RajaOngkir blocks direct browser requests due to CORS. Use a server-side OngkirHub runtime or HTTP boundary for RajaOngkir.";
  }

  if (
    providerKey === "rajaongkir" &&
    (code === "LOCATION_NOT_FOUND" || code === "LOCATION_AMBIGUOUS")
  ) {
    return "The selected Google location is too POI-specific or does not map cleanly to RajaOngkir's location hierarchy. Try selecting a broader neighborhood, kelurahan, or district instead of a landmark or station.";
  }

  return message;
}

function QuotePanel() {
  const hub = useOngkirHub();
  const [origin, setOrigin] = useState<NormalizedPlace | null>(null);
  const [destination, setDestination] = useState<NormalizedPlace | null>(null);
  const [providerRequests, setProviderRequests] = useState<Record<string, QuoteRequest>>({});
  const [quotes, setQuotes] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedProviders = hub.getHealth().providers;

  const originRef = useRef<HTMLInputElement>(null);
  const destRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!window.google || !originRef.current || !destRef.current) return;
    const widgets: google.maps.places.Autocomplete[] = [];
    if (originRef.current) widgets.push(attachAutocomplete(originRef.current, window.google, setOrigin));
    if (destRef.current) widgets.push(attachAutocomplete(destRef.current, window.google, setDestination));
    return () => { widgets.forEach((w) => google.maps.event.clearInstanceListeners(w)); };
  }, []);

  const fetchQuotes = async () => {
    if (!origin || !destination) return;
    setLoading(true);
    setError(null);
    try {
      const aggregatedQuotes: Quote[] = [];
      const nextProviderRequests: Record<string, QuoteRequest> = {};

      for (const providerKey of selectedProviders) {
        const request: QuoteRequest = {
          origin:
            providerKey === "rajaongkir"
              ? toHierarchyLocation(origin.location)
              : providerKey === "biteship"
                ? toPostalLocation(origin.location)
                : origin.location,
          destination:
            providerKey === "rajaongkir"
              ? toHierarchyLocation(destination.location)
              : providerKey === "biteship"
                ? toPostalLocation(destination.location)
                : destination.location,
          parcels: [{ weightGrams: 1500 }],
          totalWeightGrams: 1500,
        };
        nextProviderRequests[providerKey] = request;
      }

      setProviderRequests(nextProviderRequests);

      for (const providerKey of selectedProviders) {
        const request = nextProviderRequests[providerKey]!;
        const result = await hub.getQuotes(request, { providers: [providerKey] });
        aggregatedQuotes.push(...result.quotes);
      }
      setQuotes(aggregatedQuotes);
    } catch (err: any) {
      setError(formatProviderError(err, selectedProviders));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: "8px" }}>
        <label>Origin</label>
        <input ref={originRef} type="text" placeholder="Search origin address..." style={{ width: "100%", padding: "8px" }} />
        {origin && (
          <>
            <div style={{ fontSize: "12px", color: "#666" }}>{origin.rawLabel}</div>
            <pre
              style={{
                marginTop: "6px",
                padding: "8px",
                borderRadius: "4px",
                background: "#f8f9fa",
                border: "1px solid #e5e7eb",
                fontSize: "12px",
                overflowX: "auto",
              }}
            >
              {JSON.stringify(origin.location, null, 2)}
            </pre>
          </>
        )}
      </div>
      <div style={{ marginBottom: "8px" }}>
        <label>Destination</label>
        <input ref={destRef} type="text" placeholder="Search destination address..." style={{ width: "100%", padding: "8px" }} />
        {destination && (
          <>
            <div style={{ fontSize: "12px", color: "#666" }}>{destination.rawLabel}</div>
            <pre
              style={{
                marginTop: "6px",
                padding: "8px",
                borderRadius: "4px",
                background: "#f8f9fa",
                border: "1px solid #e5e7eb",
                fontSize: "12px",
                overflowX: "auto",
              }}
            >
              {JSON.stringify(destination.location, null, 2)}
            </pre>
          </>
        )}
      </div>
      <button onClick={fetchQuotes} disabled={loading || !origin || !destination} style={{ padding: "8px 16px" }}>
        {loading ? "Loading..." : "Get Quotes"}
      </button>
      {error && <div style={{ color: "#dc3545", marginTop: "8px" }}>{error}</div>}
      {Object.keys(providerRequests).length > 0 && (
        <div style={{ marginTop: "16px" }}>
          <h4>Provider request preview</h4>
          {Object.entries(providerRequests).map(([providerKey, request]) => (
            <div key={providerKey} style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#666" }}>{providerKey}</div>
              <pre
                style={{
                  marginTop: "6px",
                  padding: "8px",
                  borderRadius: "4px",
                  background: "#f8f9fa",
                  border: "1px solid #e5e7eb",
                  fontSize: "12px",
                  overflowX: "auto",
                }}
              >
                {JSON.stringify(request, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
      {quotes && (
        <div style={{ marginTop: "16px" }}>
          <h4>Quotes ({quotes.length})</h4>
          {quotes.map((q, i) => (
            <div key={i} style={{ border: "1px solid #ddd", padding: "8px", marginBottom: "4px", borderRadius: "4px" }}>
              {q.serviceName} ({q.providerKey}) — {q.price.amount.toLocaleString()} {q.price.currency}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function App() {
  const [googleKey, setGoogleKey] = useState("");
  const [googleReady, setGoogleReady] = useState(false);
  const [providers, setProviders] = useState<ShippingProvider[]>([mockProvider, defaultManualProvider]);
  const hub = useMemo(() => createOngkirHub({ providers }), [providers]);

  useEffect(() => {
    if (!googleKey) return;
    loadGoogleMaps(googleKey).then(() => setGoogleReady(true)).catch(() => setGoogleReady(false));
  }, [googleKey]);

  return (
    <div style={{ maxWidth: "640px", margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1>Runtime + Google Maps Demo</h1>
      <DemoWarning />
      <div style={{ marginBottom: "16px" }}>
        <input type="text" placeholder="Google Maps API Key" value={googleKey} onChange={(e) => setGoogleKey(e.target.value)} style={{ width: "100%", padding: "8px" }} />
      </div>
      <OngkirHubProvider hub={hub}>
        <ProviderSetup onProvidersChange={setProviders} />
        {googleReady && <QuotePanel />}
        {!googleReady && googleKey && <div style={{ color: "#666" }}>Loading Google Maps...</div>}
      </OngkirHubProvider>
    </div>
  );
}
