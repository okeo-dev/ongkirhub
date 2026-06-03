# RajaOngkir International Readiness Review

**Date:** 2026-06-03  
**Scope:** Determine whether OngkirHub v0.1 contracts are sufficient for RajaOngkir international shipping quotes  
**Constraint:** No code changes in this review. No `@ongkirhub/core` modifications.

---

## Executive Summary

The current OngkirHub architecture is **likely sufficient** for a first international wave, with **two manageable pressure points**:

1. **Country ID resolution** — RajaOngkir international uses numeric country IDs (e.g. `108` for Malaysia), not ISO country codes. A provider-local country mapping is needed, analogous to the existing domestic `level4` mapping.
2. **Courier scope** — International couriers are a different set from domestic (POS, SLIS, Expedito, Rayspeddia vs JNE, TIKI, etc.). The provider must either use a separate courier list or validate that requested couriers support international routes.

No core contract changes appear necessary for a first rates-only wave, but this should be validated during implementation.

---

## 1. Package Boundary

**Recommendation: Keep international inside `@ongkirhub/provider-rajaongkir`.**

Rationale:

- The upstream vendor is the same (RajaOngkir / Komerce)
- The authentication mechanism, base URL, and response shape are identical
- The provider already has location resolution infrastructure that can be extended
- Splitting into a second package would duplicate auth, client, and config code without a clear architectural boundary

The provider should internally branch on route type:
- `origin.countryCode === "ID" && destination.countryCode !== "ID"` → international path
- `origin.countryCode === "ID" && destination.countryCode === "ID"` → domestic path (existing)
- `origin.countryCode !== "ID"` → reject with `UNSUPPORTED_ROUTE` (RajaOngkir only supports Indonesia-origin international)

---

## 2. Input Contract Sufficiency

The current `QuoteRequest` shape is **likely sufficient for a first international rates + ETA wave**:

```
origin: LocationInput
destination: LocationInput
parcels: Parcel[]
totalWeightGrams: number
declaredValue?: Money       ← already exists, useful for customs
metadata?: Record<string, unknown>
```

### Field analysis

| Field | Domestic | International | Assessment |
|-------|----------|---------------|------------|
| `origin` + `destination` | ✅ | ✅ | Sufficient. Country code disambiguates route type. |
| `parcels[].weightGrams` | ✅ | ✅ | Required by RajaOngkir international API. |
| `parcels[].dimensions` | optional | optional | RajaOngkir accepts length/width/height but does not require them. |
| `totalWeightGrams` | ✅ | ✅ | Required. |
| `declaredValue` | ignored | useful | Present in core contract (`QuoteRequest.declaredValue?: Money`). Can be passed as provider-local metadata for customs valuation if the upstream endpoint accepts it. Not required for basic quotes. |
| `parcels[].quantity` | optional | optional | No change needed. |

### Fields RajaOngkir international does NOT require (out of scope for first wave)

- **Commodity/category** — Not required by RajaOngkir `internationalCost` endpoint
- **Harmonized/customs codes** — Not required for basic rate quotes
- **Shipment type** — Not a separate parameter in the API
- **Dimensions as required** — Optional in the API, same as domestic

### Conclusion

No additional fields appear necessary yet for a basic international quote. The existing shape should be validated during implementation.

---

## 3. Location Model Sufficiency

### Domestic recap

The domestic provider uses `level4` records with provider-local IDs (e.g. `c501` → city ID `501`). The resolver maps hierarchical location input (`level1`→`level2`→`level3`→`level4`) to a numeric RajaOngkir city/subdistrict ID.

### International requirements

RajaOngkir international endpoints require:

- **Origin:** An Indonesian city ID (same numeric IDs as domestic)
- **Destination:** A numeric country ID from RajaOngkir's `internationalDestination` endpoint

### Assessment

| Question | Answer |
|----------|--------|
| Is a global provider-owned mapping needed? | **No.** A provider-local country ID mapping (countryCode → RajaOngkir country ID) is sufficient, analogous to the domestic location records. |
| Can international routes work with country + postal/city-style data? | **Partially.** The `destination` only needs `countryCode` for the first wave. RajaOngkir international resolves to country-level, not city-level. The `origin` still needs city-level precision (same as domestic). |
| Does RajaOngkir international require country/provider-specific IDs? | **Yes.** Destination requires RajaOngkir country IDs. These should be stored provider-locally, not in core. |

### Country ID resolution strategy

The provider should maintain a `RAJAONGKIR_COUNTRY_RECORDS` mapping:

```typescript
{
  "MY": { providerId: "108", name: "Malaysia" },
  "SG": { providerId: "200", name: "Singapore" },
  // ... etc
}
```

This is analogous to the domestic `RAJAONGKIR_LOCATION_RECORDS` but flat (country-level only). It can be bootstrapped from the `destination/international-destination` endpoint and compiled into the package at build time, same as the domestic dataset.

### Origin resolution for international

For international origin, the provider reuses the existing domestic resolver:
- If `origin` has `level1`–`level4`, resolve through the domestic mapping (same as today)
- If `origin` has `postalCode`, a postal-code→city-ID mapping may be needed, or fall back to requiring hierarchical levels
- The resolved origin ID is passed to `POST /calculate/international-cost`

### Conclusion

The `LocationInput` model is likely sufficient for a first wave. International destination only needs `countryCode`. No core changes appear necessary yet. The provider needs a new provider-local country ID dataset, similar in pattern to the existing domestic location records.

---

## 4. Quote Contract Sufficiency

The current `Quote` contract:

```typescript
interface Quote {
  providerKey: string;
  serviceCode: string;
  serviceName: string;
  price: Money;
  estimatedDuration: Duration;
  eta?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}
```

### Assessment

| Concern | Assessment |
|---------|------------|
| **Currency** | ✅ Sufficient. `Money` has `{ amount, currency }`. RajaOngkir international returns IDR rates (same as domestic). If multi-currency is needed later, the contract already supports it. |
| **Duty/tax visibility** | ⚠️ Not in contract. RajaOngkir basic international quotes do not include duty/tax breakdown. If needed later, it can go in `metadata` or a v0.2 contract extension. **Not needed for first wave.** |
| **ETA semantics** | ✅ Sufficient. International ETAs are longer (e.g. "5–14 days") but fit the same `Duration { value, unit }` shape. The `eta?: string` field can hold the raw upstream text. |
| **Service naming** | ✅ Sufficient. Same pattern as domestic: `${courier} ${service}` or `${courier}-${service}`. |

### Conclusion

The `Quote` contract is likely sufficient for international rates + ETA. Changes should only be made if implementation reveals a concrete gap.

---

## 5. Minimal Safe Scope

### Include (first wave)

- International rates + ETA for Indonesia-origin shipments
- `POST /calculate/international-cost` integration
- Provider-local country ID mapping (compiled dataset)
- Route detection: `ID` → non-`ID` triggers international path
- International courier list (e.g. `pos,slis,expedito,ray`)

### Exclude (first wave)

- Customs documents ( Commercial Invoice, packing list)
- Landed-cost breakdown (duty, tax, handling fees)
- Restricted goods validation
- Multi-origin international (non-ID origin)
- Booking / labels / tracking
- Real-time country dataset refresh (compile at build time, same as domestic)

---

## What Looks Compatible Already

| Component | Compatibility |
|-----------|--------------|
| `ShippingProvider` interface | ✅ Appears compatible. No change expected. |
| `QuoteRequest` shape | ✅ Likely sufficient for first wave. Validate during implementation. |
| `LocationInput` model | ✅ Likely sufficient for first wave. Validate during implementation. |
| `Quote` contract | ✅ Likely sufficient for first wave. Validate during implementation. |
| `ProviderCapabilities.coverage` | ✅ Already includes `"international"`, which suggests the core anticipated this expansion. |
| Provider-local location mapping pattern | ✅ Reuse domestic pattern for country IDs. Unproven but analogous. |
| Debug envelope (`getDebugInfo`) | ✅ Same pattern should work. |
| Error codes (`UPSTREAM_*`, `UNSUPPORTED_ROUTE`) | ✅ Appears sufficient. Validate during implementation. |

---

## Likely Pressure Points

| Pressure Point | Severity | Mitigation |
|----------------|----------|------------|
| **Country ID dataset** | Medium | Build a compiled country mapping at build time, same pattern as domestic `level4` records. Bootstrap from `GET /destination/international-destination`. |
| **Origin resolution for international** | Low | Reuse existing domestic resolver. International origin is still an Indonesian city. |
| **Courier validation** | Low | International supports a different courier set. Validate early and reject unsupported couriers with a clear error. |
| **ETA accuracy** | Low | International ETAs are ranges ("5–14 days"). `parseEstimatedDuration` may need enhancement for wider ranges. |
| **Declared value / customs** | Low | `declaredValue` is already in `QuoteRequest`. Pass through to API if the endpoint supports it. Not required for basic quotes. |

---

## Changes That Should NOT Be Made Prematurely

1. **Do not add a global location database to core** — Provider-local country IDs are sufficient, same as the domestic pattern.
2. **Do not add customs-heavy fields to core** — `declaredValue` is present in the core contract but untested for international customs use. Duty/tax breakdown can wait for v0.2.
3. **Do not split RajaOngkir into a second package** — Same vendor, same auth, same response shape. Branching internally is cleaner.
4. **Do not change `LocationInput` to require country IDs** — The provider should map `countryCode` → provider ID internally.
5. **Do not add international-specific provider keys** — `rajaongkir` should handle both domestic and international routes.

---

## Recommended First Implementation Scope

1. **Create `src/location/country-resolve.ts`** — Country code → RajaOngkir country ID resolver, plus `RAJAONGKIR_COUNTRY_RECORDS` dataset.
2. **Bootstrap country dataset** — Use a script (similar to `fetch-live-locations.py`) to call `GET /destination/international-destination` and compile a JSON/YAML dataset.
3. **Add `calculateInternationalCost()` to `RajaOngkirClient`** — `POST /calculate/international-cost` with origin city ID, destination country ID, weight, courier.
4. **Branch `getQuotes()` in provider** — Detect `destination.countryCode !== "ID"` and route to international path.
5. **Update capabilities** — Change `coverage: ["domestic"]` to `coverage: ["domestic", "international"]`.
6. **Add tests** — Mocked international API response, country resolution, route detection, error paths.
7. **Update env/config** — Optional `RAJAONGKIR_INTERNATIONAL_COURIERS` env var (or reuse `RAJAONGKIR_COURIERS` with validation).

Estimated effort: small-to-medium. The pattern is already proven from domestic implementation.
