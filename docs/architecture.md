# Architecture

OngkirHub v0.1 is a pnpm monorepo with strict package boundaries.

## Layers

```text
HTTP (@ongkirhub/api)
  -> validates requests
  -> selects registered providers
  -> aggregates normalized quotes

Providers (@ongkirhub/provider-*)
  -> implement ShippingProvider
  -> depend on @ongkirhub/core only

Core (@ongkirhub/core)
  -> domain types and provider contract
  -> location input contract, normalization, resolver algorithm, shared LOCATION_* errors
  -> no HTTP, persistence, provider SDK code, or mapping datasets
```

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

Registration is explicit in `apps/api/src/registry/providers.ts`. There is no auto-discovery or side-effect imports in `core`.

Enable providers with `ENABLED_PROVIDERS=mock,manual` (default). To add RajaOngkir, include `rajaongkir` and set `RAJAONGKIR_API_KEY` plus `RAJAONGKIR_COURIERS` in the API process environment. The API composes `createRajaOngkirProvider` with compiled `RAJAONGKIR_LOCATION_RECORDS` from `@ongkirhub/provider-rajaongkir`; secrets stay in `apps/api` config, not inside the provider package.

## Design constraints for v0.1

- Rates and ETA only
- No database, cache, or queue workers
- Provider-neutral JSON responses
- One runtime module strategy (Node.js ESM)
