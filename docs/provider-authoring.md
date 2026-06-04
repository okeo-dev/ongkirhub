# Provider authoring

A shipping provider implements the `ShippingProvider` interface from `@ongkirhub/core`.

## Minimal implementation

```typescript
import type { Quote, QuoteRequest, ShippingProvider } from "@ongkirhub/core";

export function createAcmeProvider(): ShippingProvider {
  return {
    key: "acme",
    name: "Acme Courier",
    capabilities: {
      coverage: ["domestic"],
      dimensionsRequired: false,
      codSupported: false,
      serviceFilteringSupported: false,
    },
    async getQuotes(request: QuoteRequest): Promise<Quote[]> {
      return [
        {
          providerKey: "acme",
          serviceCode: "REG",
          serviceName: "Regular",
          price: { amount: 18000, currency: "IDR" },
          estimatedDuration: { value: 2, unit: "days" },
          metadata: { weightGrams: request.totalWeightGrams },
        },
      ];
    },
  };
}
```

## Contract requirements

- `getQuotes` must return normalized `Quote` objects.
- Every quote `providerKey` must match the provider `key`.
- Use `ProviderError` for expected failures (`INVALID_REQUEST`, `UPSTREAM_UNAVAILABLE`, etc.).
- Do not export upstream API response types from your package.

## Conformance testing

Use the shared helper:

```typescript
import { assertProviderConformance } from "@ongkirhub/core";

await assertProviderConformance(createAcmeProvider());
```

## Configuration

Load secrets and upstream credentials in your app composition layer, not inside `getQuotes` contract code. Pass configured clients or rate tables into your provider factory (see `@ongkirhub/provider-manual`).

## Registering in the orchestration layer

**Current (v0.1):** add your built provider to `apps/api/src/registry/providers.ts` and include its key in `ENABLED_PROVIDERS`.

**Future direction:** registration moves to `@ongkirhub/runtime`, making provider orchestration usable without a web server.

## Location mappings (real providers)

Public callers send `LocationInput` (`method: "location"`). Your package resolves that into your upstream provider IDs using **provider-owned** data and the shared resolver in `@ongkirhub/core`. Do not expose provider location IDs in public API types or invent a separate resolution algorithm without documenting an exception.

### Authoring format (source of truth)

Maintain nested geography as hierarchical YAML for review and diffing, for example:

```text
packages/provider-<name>/src/location/source/locations.yaml
```

Logical schema (types live in `core` as `ProviderLocationMappingDocument`):

- `provider`, `version`, `countries[]`
- each node: `providerId`, `name`, optional `aliases`, optional `postalCodes`, nested `level1`–`level4` children

**Aliases are optional** on every node; `name` is required. Add aliases only for abbreviations, alternate languages, or common shorthand—avoid filler aliases.

### Runtime format (generated)

Compile YAML into flattened lookup rows (`ProviderLocationRecord`), for example:

```text
packages/provider-<name>/src/location/generated/locations.generated.ts
```

Each row includes: `provider`, `providerId`, `countryCode`, `level`, canonical and normalized names, normalized aliases, postal codes, optional `parentProviderId`, and a `path` snapshot (`level1`–`level4` strings). Index records for fast lookup; **do not parse large YAML on every request**.

Recommended package layout:

```text
src/location/
  source/locations.yaml
  generated/locations.generated.ts
  compile.ts
  resolve.ts
```

Generated files may be committed or produced at build time; either way, runtime uses compiled records only.

### Resolver behavior (shared in core)

1. Normalize input strings (trim, uppercase, collapse spaces, strip punctuation).
2. Match `countryCode`; fail if country absent from dataset.
3. If `postalCode` present, narrow candidates (hint only; does not override strong path mismatch).
4. Match hierarchy deepest-first; prefer exact path, then deep level + consistent ancestors, then aliases.
5. Deterministic scoring; on tie or low confidence return `LOCATION_AMBIGUOUS`—never guess.

### Provider responsibilities

- Own mapping source data and compilation.
- Register compiled records with the core resolver at provider init or quote time.
- Map resolution errors to `ProviderError` using shared location codes where appropriate.

### Provider must not

- Leak provider location IDs into public API request/response types.
- Depend on `@ongkirhub/api`.
- Rely on runtime tree walks over raw YAML for production quote paths.
