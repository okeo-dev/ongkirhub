import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createOngkirHub } from "@ongkirhub/runtime";
import { mockProvider } from "@ongkirhub/provider-mock";
import { defaultManualProvider } from "@ongkirhub/provider-manual";
import { OngkirHubProvider, useOngkirHub } from "@ongkirhub/react";
import type { ShippingProvider, QuoteRequest } from "@ongkirhub/core";
import { loadGoogleMaps, attachAutocomplete, type NormalizedPlace } from "./google.js";
import { createRajaOngkirProvider } from "../../../packages/provider-rajaongkir/dist/provider.js";
import { RAJAONGKIR_LOCATION_RECORDS } from "../../../packages/provider-rajaongkir/dist/location/generated/locations.generated.js";
import { createBiteshipProvider } from "../../../packages/provider-biteship/dist/provider.js";

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

function QuotePanel() {
  const hub = useOngkirHub();
  const [origin, setOrigin] = useState<NormalizedPlace | null>(null);
  const [destination, setDestination] = useState<NormalizedPlace | null>(null);
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
      const request: QuoteRequest = {
        origin: origin.location,
        destination: destination.location,
        parcels: [{ weightGrams: 1500 }],
        totalWeightGrams: 1500,
      };
      const result = await hub.getQuotes(request);
      setQuotes(result.quotes);
    } catch (err: any) {
      const message = err?.message ?? "Failed";
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
      <div style={{ marginBottom: "8px" }}>
        <label>Origin</label>
        <input ref={originRef} type="text" placeholder="Search origin address..." style={{ width: "100%", padding: "8px" }} />
        {origin && <div style={{ fontSize: "12px", color: "#666" }}>{origin.rawLabel}</div>}
      </div>
      <div style={{ marginBottom: "8px" }}>
        <label>Destination</label>
        <input ref={destRef} type="text" placeholder="Search destination address..." style={{ width: "100%", padding: "8px" }} />
        {destination && <div style={{ fontSize: "12px", color: "#666" }}>{destination.rawLabel}</div>}
      </div>
      <button onClick={fetchQuotes} disabled={loading || !origin || !destination} style={{ padding: "8px 16px" }}>
        {loading ? "Loading..." : "Get Quotes"}
      </button>
      {error && <div style={{ color: "#dc3545", marginTop: "8px" }}>{error}</div>}
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
