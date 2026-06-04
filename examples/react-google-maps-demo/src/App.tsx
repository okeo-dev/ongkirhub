import { useEffect, useRef, useState } from "react";
import { useShippingQuotes } from "@ongkirhub/react-api";
import type { LocationMethodInput, QuoteRequest } from "@ongkirhub/client";
import { loadGoogleMaps, attachAutocomplete, type NormalizedPlace } from "./google.js";

const DEFAULT_ORIGIN: LocationMethodInput = {
  method: "location",
  countryCode: "ID",
  level1: "DKI Jakarta",
  level2: "Jakarta Barat",
  level3: "Grogol Petamburan",
  level4: "Jelambar",
};

export function App() {
  const [apiKey, setApiKey] = useState("");
  const [googleReady, setGoogleReady] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const [useGoogleOrigin, setUseGoogleOrigin] = useState(false);
  const [origin, setOrigin] = useState<NormalizedPlace | null>(null);
  const [destination, setDestination] = useState<NormalizedPlace | null>(null);

  const originInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);

  // Load Google Maps when API key is provided
  useEffect(() => {
    if (!apiKey) return;
    setGoogleError(null);
    loadGoogleMaps(apiKey)
      .then(() => setGoogleReady(true))
      .catch((err) => {
        setGoogleError(err instanceof Error ? err.message : "Google load failed");
        setGoogleReady(false);
      });
  }, [apiKey]);

  // Attach autocomplete widgets when Google is ready and inputs are mounted
  useEffect(() => {
    if (!googleReady || !window.google) return;

    const widgets: google.maps.places.Autocomplete[] = [];

    if (useGoogleOrigin && originInputRef.current) {
      widgets.push(
        attachAutocomplete(originInputRef.current, window.google, setOrigin),
      );
    }
    if (destInputRef.current) {
      widgets.push(
        attachAutocomplete(destInputRef.current, window.google, setDestination),
      );
    }

    return () => {
      for (const w of widgets) {
        window.google!.maps.event.clearInstanceListeners(w);
      }
    };
  }, [googleReady, useGoogleOrigin]);

  const effectiveOrigin = useGoogleOrigin
    ? origin?.location ?? null
    : DEFAULT_ORIGIN;

  function isBroadLocation(location: LocationMethodInput): boolean {
    return !location.level4;
  }

  const request: QuoteRequest | null =
    effectiveOrigin && destination
      ? {
          origin: effectiveOrigin,
          destination: destination.location,
          parcels: [{ weightGrams: 1500 }],
          totalWeightGrams: 1500,
        }
      : null;

  const { quotes, isLoading, isSuccess, error } = useShippingQuotes(request ?? {
    origin: { method: "location", countryCode: "ID" },
    destination: { method: "location", countryCode: "ID" },
    parcels: [{ weightGrams: 1500 }],
    totalWeightGrams: 1500,
  }, { enabled: request !== null });

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 640, margin: "40px auto", padding: 20 }}>
      <h1>OngkirHub Google Maps Demo</h1>

      {/* API Key */}
      <section style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
          Google Places API Key
        </label>
        <input
          type="password"
          placeholder="Paste your API key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          style={{ width: "100%", padding: 8, fontSize: 14 }}
        />
        {googleError && (
          <div style={{ color: "#991b1b", marginTop: 6, fontSize: 13 }}>
            {googleError}
          </div>
        )}
        {!apiKey && (
          <div style={{ color: "#6b7280", marginTop: 6, fontSize: 13 }}>
            Enter a key to enable location search.
          </div>
        )}
      </section>

      {/* Origin mode */}
      <section style={{ marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={useGoogleOrigin}
            onChange={(e) => setUseGoogleOrigin(e.target.checked)}
            disabled={!googleReady}
          />
          <span>Use Google-selected origin (unchecked = default origin)</span>
        </label>
      </section>

      {/* Origin inputs */}
      {useGoogleOrigin ? (
        <section style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
            Origin address
          </label>
          <input
            ref={originInputRef}
            type="text"
            placeholder="Search origin address..."
            style={{ width: "100%", padding: 8, fontSize: 14 }}
          />
        </section>
      ) : (
        <section style={{ marginBottom: 16, padding: 12, background: "#f3f4f6", borderRadius: 6 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Default origin</div>
          <code style={{ fontSize: 13 }}>{DEFAULT_ORIGIN.level4}, {DEFAULT_ORIGIN.level3}, {DEFAULT_ORIGIN.level2}, {DEFAULT_ORIGIN.level1}</code>
        </section>
      )}

      {/* Destination input */}
      <section style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
          Destination address
        </label>
        <input
          ref={destInputRef}
          type="text"
          placeholder="Search destination address..."
          style={{ width: "100%", padding: 8, fontSize: 14 }}
        />
      </section>

      {/* Normalized preview */}
      {(origin || destination || !useGoogleOrigin) && (
        <section style={{ marginBottom: 24, padding: 12, border: "1px solid #e5e7eb", borderRadius: 6, background: "#fafafa" }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Normalized request preview</div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Origin</div>
            {useGoogleOrigin ? (
              origin ? (
                <div>
                  <div style={{ fontSize: 13 }}>{origin.rawLabel}</div>
                  <pre style={{ fontSize: 12, margin: "4px 0 0", overflow: "auto" }}>
                    {JSON.stringify(origin.location, null, 2)}
                  </pre>
                  {isBroadLocation(origin.location) && (
                    <div style={{ marginTop: 6, padding: 8, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 4, fontSize: 12, color: "#92400e" }}>
                      The selected origin is still quite broad. For more accurate shipping fees, choose a more detailed location when possible, ideally up to subdistrict (level 4).
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "#9ca3af" }}>No origin selected</div>
              )
            ) : (
              <pre style={{ fontSize: 12, margin: "4px 0 0", overflow: "auto" }}>
                {JSON.stringify(DEFAULT_ORIGIN, null, 2)}
              </pre>
            )}
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Destination</div>
            {destination ? (
              <div>
                <div style={{ fontSize: 13 }}>{destination.rawLabel}</div>
                <pre style={{ fontSize: 12, margin: "4px 0 0", overflow: "auto" }}>
                  {JSON.stringify(destination.location, null, 2)}
                </pre>
                {isBroadLocation(destination.location) && (
                  <div style={{ marginTop: 6, padding: 8, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 4, fontSize: 12, color: "#92400e" }}>
                    The selected destination is still quite broad. For more accurate shipping fees, choose a more detailed location when possible, ideally up to subdistrict (level 4).
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#9ca3af" }}>No destination selected</div>
            )}
          </div>
        </section>
      )}

      {/* Quotes */}
      {request && (
        <section>
          {isLoading && <p>Loading quotes…</p>}

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
        </section>
      )}

      {!request && (
        <p style={{ color: "#6b7280" }}>
          Select a destination to fetch quotes.
          {useGoogleOrigin && " Also select an origin."}
        </p>
      )}
    </div>
  );
}
