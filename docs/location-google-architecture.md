# `@ongkirhub/location-google` Architecture Brief

## Context

OngkirHub's product boundary explicitly excludes address forms, autocomplete UI, Google Maps integration, checkout UX, and remediation flows. However, a repeated integration pain point has emerged: applications using Google Places Autocomplete repeatedly write nearly identical parsing code to extract `countryCode`, `postalCode`, `level1`–`level4`, and coordinates from Google's address component payloads.

This brief evaluates whether Google place-data normalization is a legitimate ecosystem concern that OngkirHub should own, and if so, what the package boundary and API should look like.

---

## 1. Ecosystem fit assessment

### Why it fits

Google place-data normalization is a **source-data conversion** problem, not a UI problem. It converts an external data format (Google Places API response) into provider-neutral structured data (`LocationInput` fields) that OngkirHub already defines and owns.

The boundary test:

| Concern | Owner | Fits OngkirHub? |
|---------|-------|-----------------|
| Google Maps widget rendering | Application | ❌ UI |
| Places Autocomplete UX | Application | ❌ UI |
| Place selection callback handling | Application | ❌ UI |
| **Extracting structured data from a Google Place result** | **OngkirHub?** | **✅ Data normalization** |
| Location refinement after provider rejection | Application | ❌ Remediation |
| Checkout-specific location decisions | Application | ❌ Checkout |

The conversion from `google.maps.places.PlaceResult` → `{ countryCode, postalCode, level1, level2, ... }` is pure data transformation. It is provider-neutral. It does not touch UI, remediation, or checkout. It fits the ecosystem.

### Why it does not violate the locked boundary

The locked boundary says OngkirHub does not own:
- address forms
- autocomplete
- Google Maps or map selection
- checkout UX
- retry/remediation UX after location errors

A `location-google` package does none of those. It takes a *place object that the application already obtained* and normalizes it. The application still owns:
- rendering the autocomplete input
- handling the selection event
- deciding what to do with the normalized output
- remediating when providers reject the location

---

## 2. Package naming recommendation

### Recommended: `@ongkirhub/location-google`

**Why this name:**

1. **Source-specific.** It names the input source (Google), not the output. This makes it clear the package is about normalizing Google data.
2. **Extensible.** Leaves room for `@ongkirhub/location-mapbox`, `@ongkirhub/location-osm`, `@ongkirhub/location-here` without naming collisions.
3. **Not generic.** A generic `@ongkirhub/location-utils` or `@ongkirhub/helpers` would become a dumping ground. Source-specific packages keep boundaries clean.

### Alternative considered: `@ongkirhub/google-places`

Rejected because:
- It implies Places API client code (search, autocomplete), which is UI and out of scope
- `location-google` keeps the focus on *location data normalization*, not the full Places API surface

---

## 3. Output contract recommendation

### Step 1: Normalization — parse everything

`normalizeGooglePlace(place)` always returns a **rich normalized shape** containing everything extractable from the Google payload. There is no `resultType` at this layer.

```ts
export interface NormalizedGooglePlace {
  countryCode: string | null;
  postalCode: string | null;
  level1: string | null;        // administrative_area_level_1
  level2: string | null;        // administrative_area_level_2
  level3: string | null;        // administrative_area_level_3
  level4: string | null;        // administrative_area_level_4 / sublocality
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string | null;
  source: {
    provider: "google";
    placeId: string | null;
    types: string[];
  };
}

export function normalizeGooglePlace(
  place: google.maps.places.PlaceResult,
): NormalizedGooglePlace;
```

**Why parse everything:**

1. The rich shape is useful for display/logging even if not all fields are sent to providers.
2. The caller can project the same normalized result multiple ways without re-parsing Google data.
3. It keeps the normalization step (understanding Google types) separate from the projection step (deciding which fields form a valid `LocationInput`).

### Step 2: Projection — shape into `LocationInput`

`toLocationInput(normalized, options)` projects the rich shape into a `LocationInput`. This is where `resultType` lives.

```ts
export function toLocationInput(
  normalized: NormalizedGooglePlace,
  options?: {
    resultType?: "hierarchy" | "postalCode" | "full";
  },
): LocationInput;
```

**`resultType` behavior:**

| Mode | `LocationInput` fields included | Rationale |
|------|-------------------------------|-----------|
| `"hierarchy"` (default) | `countryCode`, `level1`–`level4` | Administrative hierarchy is the most reliable identifier for provider location resolution. Postal codes can be ambiguous or map to multiple service areas. |
| `"postalCode"` | `countryCode`, `postalCode` | Minimal shape for postal-code-first integrations. Omits hierarchy to avoid postal/hierarchy mismatch errors. |
| `"full"` | `countryCode`, `postalCode`, `level1`–`level4` | Maximum information. Lets the provider's own resolution logic decide which field to prioritize. |

**Default: `"hierarchy"`** because:
- The existing React Google Maps demo was built around hierarchy-first normalization
- Hierarchy tends to be more reliable across the current provider mix
- It avoids the postal/hierarchy mismatch class of errors seen with RajaOngkir

**Why `resultType` belongs on projection, not normalization:**

1. **Data preservation.** Putting `resultType` on `normalizeGooglePlace` would mean throwing away data at parse time. The caller might want `formattedAddress` or coordinates for display even when sending only hierarchy to providers.
2. **Reusability.** A single `NormalizedGooglePlace` can be projected into `"postalCode"` for one request and `"hierarchy"` for another without re-parsing Google data.
3. **Separation of concerns.** Normalization understands Google types. Projection understands OngkirHub request shapes. They are different skills and may evolve independently.

### Step 3: Convenience — one-call helper (optional)

For the common case where the caller wants to go straight from Google Place to `LocationInput`:

```ts
export function googlePlaceToLocationInput(
  place: google.maps.places.PlaceResult,
  options?: {
    resultType?: "hierarchy" | "postalCode" | "full";
  },
): LocationInput {
  return toLocationInput(normalizeGooglePlace(place), options);
}
```

This is purely a convenience wrapper around the two-step API. It does not add new semantics.

---

## 4. `resultType` evaluation summary

| Position | Rationale |
|----------|-----------|
| **`resultType` exists** | Yes — it solves a real shaping problem. Callers need to choose between hierarchy-first, postal-code-first, or full output. |
| **`resultType` is provider-neutral** | Yes — modes are named by shape (`hierarchy`, `postalCode`, `full`), not by provider. |
| **`resultType` lives on projection** | Yes — `toLocationInput(normalized, { resultType })`, not `normalizeGooglePlace(place, { resultType })`. Parse-once, project-later. |
| **Default is `"hierarchy"`** | Yes — most reliable for the current provider mix. Caller can always override. |

---

## 5. Future extensibility

### Shared normalized shape

If `@ongkirhub/location-mapbox` or `@ongkirhub/location-osm` are added later, they should converge on a shared normalized shape defined in `@ongkirhub/core`:

```ts
// In @ongkirhub/core
export interface NormalizedPlaceData {
  countryCode: string | null;
  postalCode: string | null;
  level1: string | null;
  level2: string | null;
  level3: string | null;
  level4: string | null;
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string | null;
  source: {
    provider: string;
    placeId: string | null;
    types: string[];
  };
}
```

Each `location-*` package exports its own parser:

```ts
// @ongkirhub/location-google
export function normalizeGooglePlace(place: google.maps.places.PlaceResult): NormalizedPlaceData;

// @ongkirhub/location-mapbox (future)
export function normalizeMapboxPlace(place: mapboxgl.GeocoderResult): NormalizedPlaceData;
```

### `@ongkirhub/location-google` does not need to wait for this

The shared shape can be defined later. The Google package should define its own `NormalizedGooglePlace` interface locally. If a shared shape is added to `core`, the Google package can adopt it in a minor update.

---

## 6. Risks and tradeoffs

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Google changes address component payload shapes | Medium | Medium | Pin to tested types; update when Google changes |
| Ambiguous administrative hierarchies (level1 vs level2 varies by country) | High | Medium | Document that levels are best-effort; applications may need country-specific overrides |
| Users assume normalized data is provider-safe | Medium | High | Document clearly: normalization is source-to-neutral, not neutral-to-provider. Provider rejection is still possible. |
| `"full"` mode causes postal/hierarchy mismatch errors | Medium | Medium | Default is `"hierarchy"`; `"full"` is opt-in and documented as "maximum information, provider decides" |
| Ecosystem sprawl (many `location-*` packages) | Low | Low | Acceptable; each is small and source-specific |
| Package bloat if Google types are bundled | Low | Low | Depend on `@types/google.maps` as peer or dev dependency; do not bundle Google SDK |
| Users ask for provider-specific projection helpers | Medium | Medium | Push back: projection modes are shape-based, not provider-based. No `forRajaOngkir` / `forBiteship`. |

---

## 7. Recommendation on whether to proceed

**Proceed.**

Google place-data normalization is a legitimate, provider-neutral data transformation concern. It does not violate the locked product boundary because it touches neither UI nor remediation. It solves a real, repeated integration pain point.

### Recommended v0.1 scope

- One package: `@ongkirhub/location-google`
- One parser: `normalizeGooglePlace(place)` → `NormalizedGooglePlace`
- One projector: `toLocationInput(normalized, { resultType? })` → `LocationInput`
- One convenience helper: `googlePlaceToLocationInput(place, { resultType? })` → `LocationInput`
- `resultType` modes: `"hierarchy"` (default), `"postalCode"`, `"full"`
- Tests covering common Indonesia addresses and a few international examples
- Documentation clearly stating: this is source normalization only; provider rejection is still possible

### What is explicitly out of scope

- Google Places API client (search, autocomplete)
- Provider-specific projection helpers (`forRajaOngkir`, `forBiteship`)
- Location refinement or remediation workflows
- Caching or deduplication of normalized results
- `resultType` modes beyond `"hierarchy"`, `"postalCode"`, `"full"`

### If this package is not built

The alternative is status quo: every application writes its own Google parsing code. That is acceptable but wasteful. The normalization logic is small (~100 lines) but tricky (Google type mapping, country code extraction, hierarchy ordering). Centralizing it reduces integration errors.
