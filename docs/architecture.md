# Architecture

OngkirHub v0.1 is a pnpm monorepo with strict package boundaries.

## Layers

Current shipped path (v0.1):

```text
HTTP (@ongkirhub/api)
  -> validates requests
  -> selects registered providers
  -> aggregates normalized quotes

Core (@ongkirhub/core)
  -> domain types and provider contract
  -> location input contract, normalization, resolver algorithm, shared LOCATION_* errors
  -> no HTTP, persistence, provider SDK code, or mapping datasets

Providers (@ongkirhub/provider-*)
  -> implement ShippingProvider
  -> depend on @ongkirhub/core only
```

Future direction:

```text
Core (@ongkirhub/core)
  -> domain types and provider contract
  -> location input contract, normalization, resolver algorithm, shared LOCATION_* errors
  -> no HTTP, persistence, provider SDK code, or mapping datasets

Runtime (future: @ongkirhub/runtime)
  -> provider registry construction
  -> quote orchestration across providers
  -> health reporting

HTTP (@ongkirhub/api)
  -> optional HTTP adapter over runtime
  -> validates requests
  -> maps responses to HTTP status codes
```

## Product boundary

OngkirHub stops at quote execution and structured quote failures.

```text
LocationInput + parcels
  ↓
quotes or structured errors
```

It does **not** own:

- address forms
- autocomplete
- Google Maps or map selection
- checkout UX
- retry/remediation UX after location errors
- provider-specific frontend refinement workflows

Those are consuming-application concerns.

Examples and demos may explore those flows, but they are not framework commitments.

## Ownership

| Concern | Owner |
| --- | --- |
| `LocationInput`, `QuoteRequest`, `Quote`, structured provider errors | OngkirHub |
| provider orchestration and normalized quote execution | OngkirHub |
| provider debug metadata | OngkirHub |
| thin API/client/react request abstractions | OngkirHub |
| address collection UX | consuming application |
| autocomplete / Google Maps integration | consuming application |
| location refinement UX and remediation flow | consuming application |
| checkout-specific decisions | consuming application |

## Location resolution (frozen contract)

OngkirHub does not maintain a global location registry or canonical location IDs. Callers send provider-neutral `LocationInput`; each provider resolves that input into its own internal IDs using provider-owned mappings and machinery defined in `core`.

```text
Public API / QuoteRequest
  origin, destination: LocationInput (method: "location" in v0.1)

@ongkirhub/core/location
  normalize input tokens
  run shared resolver against ProviderLocationRecord[] (supplied by provider)
  -> providerId + shared errors (not found, ambiguous, not configured)

@ongkirhub/provider-*
  hierarchical YAML (authoring, human-maintained)
  compile -> flattened ProviderLocationRecord rows (runtime, indexed)
  no provider IDs in public types; no dependency on api
```

**Separation of concerns**

| Concern | Owner |
| --- | --- |
| `LocationInput`, optional future `CoordinateInput` | `core` |
| Normalization rules, resolver algorithm, scoring, ambiguity rules | `core` |
| `ProviderLocationMappingDocument` schema types | `core` |
| `ProviderLocationRecord` runtime row shape | `core` |
| Mapping source data (YAML), compile step, provider IDs | each `provider-*` package |

Runtime resolution must use compiled flat records, not tree traversal of raw YAML. Postal codes are a strong hint, not a universal truth. `level1`–`level4` are semantic-free hierarchy slots, not fixed administrative labels.

`CoordinateInput` exists in `@ongkirhub/core` as a future-safe union member. The v0.1 HTTP API accepts only `method: "location"` until a tested reverse resolver package exists.

## Dependency rules

Allowed:

- `apps/api` -> `core`, `provider-*`
- `provider-*` -> `core`
- `examples/basic-server` -> `api`

Forbidden:

- `core` -> anything outside core
- `provider-*` -> `api`
- `provider-*` -> other providers

## Provider registration

Registration is explicit. There is no auto-discovery or side-effect imports in `core`.

**Current (v0.1):** registration happens in `apps/api/src/registry/providers.ts`, which is the HTTP adapter's orchestration layer.

**Future direction:** registration moves to `@ongkirhub/runtime`, making provider orchestration usable without a web server.

Enable providers with `ENABLED_PROVIDERS=mock,manual` (default). To add RajaOngkir, include `rajaongkir` and set `RAJAONGKIR_API_KEY` plus `RAJAONGKIR_COURIERS` in the API process environment. The API composes `createRajaOngkirProvider` with compiled `RAJAONGKIR_LOCATION_RECORDS` from `@ongkirhub/provider-rajaongkir`; provider-specific env parsing now lives in each provider package, while the orchestration layer decides which providers are enabled.

## Design constraints for v0.1

- Rates and ETA only
- No database, cache, or queue workers
- Provider-neutral JSON responses
- One runtime module strategy (Node.js ESM)
