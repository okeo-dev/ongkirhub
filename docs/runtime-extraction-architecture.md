# Runtime Extraction Architecture Brief

> **Historical / Superseded.** This brief documents the reasoning behind extracting `@ongkirhub/runtime` from `apps/api`. The extraction is complete: `@ongkirhub/runtime` shipped in v0.1, `apps/api` was refactored into a thin HTTP adapter (`@ongkirhub/api`), and all phases described below are finished. For current architecture, see `README.md` and `docs/architecture.md`.

## Recommendation

OngkirHub should be **framework-first, server-second**.

The current `apps/api` package conflates two distinct responsibilities:

1. **Runtime orchestration** — provider registry, quote aggregation, health reporting, provider selection
2. **HTTP adaptation** — request parsing, schema validation, status-code mapping, server startup

These should be separated so that OngkirHub's core value (provider contract + orchestration) is usable without a web server.

## Proposed: `@ongkirhub/runtime`

Introduce a new package `@ongkirhub/runtime` that owns all provider-orchestration behavior. Reposition `apps/api` (publishable as `@ongkirhub/api`) as an optional HTTP adapter.

```
Application
  ↓
@ongkirhub/runtime
  ↓
providers
```

```
@ongkirhub/api
  ↓
@ongkirhub/runtime
```

### Why not fold runtime into `@ongkirhub/core`?

`@ongkirhub/core` should remain foundational and pure:

- Domain types (`Quote`, `QuoteRequest`, `ShippingProvider`)
- Validation primitives (`assertProviderConformance`)
- Location normalization and scoring
- Error taxonomy (`ProviderError`, `LocationError`)

Runtime adds orchestration *behavior* — provider registry construction, parallel quote fetching, error aggregation, health metadata — which is a separate concern from foundational contracts. Mixing them would make `core` heavier and blur the boundary between "what is a provider" and "how do I use multiple providers together."

## Responsibilities: Move vs Remain

### Move to `@ongkirhub/runtime`

| Responsibility | Current Location | Notes |
|----------------|------------------|-------|
| Provider registry construction | `apps/api/src/registry/providers.ts` | `createProviderRegistry`, `resolveProviders`, `listProviderKeys` |
| Quote orchestration | `apps/api/src/routes/quotes.ts` | Calling selected providers, aggregating results, handling partial failures, adding debug metadata |
| Health / provider listing | `apps/api/src/routes/health.ts` | Listing registered providers and versions |
| Provider selection logic | `apps/api/src/routes/quotes.ts` | Resolving requested provider keys against the registry |
| Request normalization | `apps/api/src/routes/quotes.ts` | Building the `QuoteRequest` from validated input (before HTTP specifics) |

### Remain in `@ongkirhub/api`

| Responsibility | Current Location | Notes |
|----------------|------------------|-------|
| HTTP request parsing | `apps/api/src/routes/quotes.ts` | Hono request object handling, JSON body extraction |
| Schema validation | `apps/api/src/routes/quotes.ts` | Zod schema validation of incoming HTTP payloads |
| HTTP status mapping | `apps/api/src/routes/quotes.ts` | Mapping provider errors to HTTP status codes (400, 502, etc.) |
| Response envelope formatting | `apps/api/src/routes/quotes.ts` | Adding `requestSummary`, `debug`, `providers` wrapper |
| Server startup | `apps/api/src/index.ts` | `serve()`, port binding, process signal handling |
| Generic env loading | `apps/api/src/config/env.ts` | `PORT`, `HOST`, `ENABLED_PROVIDERS` |

## Proposed Runtime API (v0.2)

### Construction

```ts
import { createOngkirHub } from "@ongkirhub/runtime";
import { createRajaOngkirProvider, loadRajaOngkirConfigFromEnv } from "@ongkirhub/provider-rajaongkir";
import { createBiteshipProvider, loadBiteshipConfigFromEnv } from "@ongkirhub/provider-biteship";

const rajaongkirEnv = loadRajaOngkirConfigFromEnv(process.env);
const biteshipEnv = loadBiteshipConfigFromEnv(process.env);

const providers = [];

if (rajaongkirEnv) {
  providers.push(
    createRajaOngkirProvider({
      ...rajaongkirEnv,
      records: RAJAONGKIR_LOCATION_RECORDS,
    }),
  );
}

if (biteshipEnv) {
  providers.push(createBiteshipProvider(biteshipEnv));
}

const hub = createOngkirHub({ providers });
```

### Quotes

```ts
const quotes = await hub.getQuotes({
  origin: { method: "location", countryCode: "ID", level1: "DKI Jakarta", level2: "Jakarta Barat" },
  destination: { method: "location", countryCode: "ID", level1: "Jawa Barat", level2: "Bandung" },
  parcels: [{ weightGrams: 1500 }],
  totalWeightGrams: 1500,
  providers: ["rajaongkir", "biteship"],
});

// Returns: Quote[] on success
// Throws: ProviderError on failure (same contract as individual providers)
```

### Health

```ts
const health = await hub.getHealth();
// Returns:
// {
//   status: "ok" | "degraded";
//   providers: string[];
//   version: string;
// }
```

### Key design decisions

1. **No env parsing in runtime** — `createOngkirHub` takes explicit provider instances. Callers (API, scripts, tests) own env parsing and provider instantiation.
2. **Same success-or-error contract as providers** — `getQuotes` follows the same `Quote[]` or `ProviderError` contract as individual providers. If partial-success across multiple providers is desired in the future, that should be a deliberate, separately scoped product change.
3. **Debug is opt-in** — Runtime collects debug metadata only when providers expose it (`provider.getDebugInfo?.()`).
4. **No caching in v0.2** — Caching is deferred per existing architecture decisions.

## Ecosystem Impact

| Package | Impact |
|---------|--------|
| `@ongkirhub/core` | None. Runtime depends on core; core remains unchanged. |
| `@ongkirhub/provider-*` | None. Providers still implement `ShippingProvider`. |
| `@ongkirhub/runtime` | **New package.** Extracted from `apps/api`. |
| `apps/api` / `@ongkirhub/api` | Becomes a thin HTTP adapter. Imports from `@ongkirhub/runtime`. Reduces its public surface. |
| `@ongkirhub/client` | None. Still calls HTTP endpoints exposed by `apps/api`. |
| `@ongkirhub/react-api` | None. Still uses `@ongkirhub/client`. |
| `@ongkirhub/widget` | None. Still uses `@ongkirhub/client`. |
| Examples | Can optionally use `@ongkirhub/runtime` directly for serverless or script-based use cases. |

## Migration Strategy

### Phase 1: Create `@ongkirhub/runtime` package (v0.2)

1. Create `packages/runtime/` with its own `package.json`, `tsconfig.json`, and vitest setup.
2. Copy `apps/api/src/registry/providers.ts` into `packages/runtime/src/registry.ts` and republish the exports.
3. Extract quote orchestration logic from `apps/api/src/routes/quotes.ts` into `packages/runtime/src/quotes.ts`.
   - Remove Hono-specific request/response handling.
   - Keep provider selection, parallel execution, result aggregation, error collection.
4. Extract health logic from `apps/api/src/routes/health.ts` into `packages/runtime/src/health.ts`.
5. Define `createOngkirHub` as the public entry point.
6. Add tests in `packages/runtime/test/` covering registry, quotes, and health.

### Phase 2: Refactor `apps/api` to use runtime (v0.2)

1. Add `@ongkirhub/runtime` as a dependency of `apps/api`.
2. Replace `createProviderRegistry` call with `createOngkirHub`.
3. Replace inline quote orchestration with `hub.getQuotes()`.
4. Replace inline health logic with `hub.getHealth()`.
5. Keep only HTTP-specific concerns: Zod validation, status mapping, response envelope formatting.
6. Verify all existing API tests still pass.

### Phase 3: Publish and document (v0.2)

1. Update `README.md` to document the new package table.
2. Add a usage example showing direct runtime use (no HTTP server).
3. Update `AGENTS.md` if package boundaries are referenced.

## Risks and Tradeoffs

| Risk | Mitigation |
|------|------------|
| `apps/api` tests break during refactor | Phase 1 creates runtime with its own tests before touching API. Phase 2 keeps all existing API tests as regression guards. |
| Runtime becomes a catch-all for non-HTTP logic | Strict boundary: runtime owns orchestration only. Env parsing stays in provider packages or API. Provider construction stays in provider packages. |
| Package proliferation | Runtime is a single new package. It replaces the implicit "runtime inside API" with an explicit package. This is a net clarity gain. |
| Breaking change for downstream users of `apps/api` | The API's HTTP surface remains unchanged. Only internal structure changes. |

## Conclusion

`@ongkirhub/runtime` should exist as a first-class package. `apps/api` should become a secondary, optional HTTP adapter. This aligns OngkirHub with its strongest asset — the provider contract and orchestration framework — rather than coupling it to a specific server deployment model.
