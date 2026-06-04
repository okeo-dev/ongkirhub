# OngkirHub

Use one quote API contract even when shipping providers use different location IDs, payloads, and response formats.

OngkirHub is an open-source shipping integration framework for teams that want to integrate multiple logistics providers without rewriting their application for each one. Its primary asset is the **provider contract** — a shared interface for quote execution, location normalization, and structured errors.

Current shipped paths (v0.1 alpha):

**Primary path: embedded runtime**
```text
Application
  ↓
@ongkirhub/runtime
  ↓
Providers
  ├── RajaOngkir
  ├── Biteship
  ├── Mock
  └── Manual
```

**Optional HTTP adapter path:**
```text
Browser / frontend
  ↓
@ongkirhub/client or @ongkirhub/react-api
  ↓
@ongkirhub/api
  ↓
@ongkirhub/runtime
  ↓
Providers
```

OngkirHub owns quote execution, normalization, and structured quote errors. It does **not** aim to become an address-entry, checkout, or location-refinement platform.

## Current status

OngkirHub is currently **alpha**:

- real providers are already implemented
- architecture has been validated against live provider APIs
- suitable for technical teams and guided adopters
- not yet positioned as a turnkey merchant/no-code product

## v0.1 scope

Included:

- normalized **rates and ETA** quotes
- `@ongkirhub/core` provider contract
- `@ongkirhub/runtime` embedded orchestration layer
- `@ongkirhub/api` optional HTTP server (`GET /health`, `POST /v0/quotes`)
- `@ongkirhub/client` TypeScript SDK
- `@ongkirhub/react` runtime-oriented React integration
- `@ongkirhub/react-api` headless React integration
- implemented providers:
  - `mock`
  - `manual`
  - `rajaongkir`
  - `biteship`

Not included yet:

- tracking, booking, labels
- persistence, caching, queues
- multi-tenant auth
- merchant-ready embeddable widget

## Provider matrix

| Provider | Status | Domestic | International | Location strategy |
| --- | --- | --- | --- | --- |
| Mock | Implemented | Yes | Yes | Synthetic |
| Manual | Implemented | Yes | Yes | Static config |
| RajaOngkir | Implemented | Yes | Yes | Hierarchy / provider mapping |
| Biteship | Implemented | Yes | No | Postal code |

## Fastest first quote

Requirements: Node.js 20+, pnpm 9.

Install:

```bash
pnpm install
```

Then run the primary embedded-runtime smoke example:

```bash
cd examples/runtime-smoke
pnpm start
```

This is the shortest path to a successful quote with no HTTP server, no provider credentials, and no extra deployment boundary.

If you specifically want to evaluate the optional HTTP adapter, run:

```bash
pnpm dev
```

The API listens on `http://0.0.0.0:3000` by default. Then send a first successful quote request using the built-in `mock` and `manual` providers:

```bash
curl -s http://localhost:3000/v0/quotes \
  -H 'content-type: application/json' \
  -d '{
    "providers": ["mock", "manual"],
    "origin": {
      "method": "location",
      "countryCode": "ID",
      "level1": "DKI Jakarta",
      "level2": "Jakarta Pusat"
    },
    "destination": {
      "method": "location",
      "countryCode": "ID",
      "level1": "Jawa Barat",
      "level2": "Bandung"
    },
    "parcels": [{ "weightGrams": 1500 }],
    "totalWeightGrams": 1500
  }' | jq
```

Example response:

```json
{
  "quotes": [
    {
      "providerKey": "mock",
      "serviceCode": "MOCK_REG",
      "serviceName": "Mock Regular",
      "price": {
        "amount": 18000,
        "currency": "IDR"
      },
      "estimatedDuration": {
        "value": 2,
        "unit": "days"
      }
    }
  ],
  "providers": ["mock", "manual"]
}
```

If you want a real provider next, enable RajaOngkir or Biteship below.

## Common adoption paths

- **Embedded runtime consumer** (current recommended path): import `@ongkirhub/runtime` directly, build a hub with provider instances, and call `hub.getQuotes()` without a web server.
- **Backend/API consumer**: run `@ongkirhub/api` as an optional HTTP adapter, enable one or more providers, and call `/v0/quotes`.
- **Browser React app**: use `@ongkirhub/react-api` with the HTTP API. Browser apps cannot bundle provider SDKs or secrets.
- **Server-side React app** (Next.js RSC, Remix, etc.): import `@ongkirhub/runtime` directly in server code and call `hub.getQuotes()`. No HTTP layer needed. Alternatively, use `@ongkirhub/react` with a hub constructed server-side.
- **Browser runtime demo/evaluation**: `@ongkirhub/react` can be used in the browser for development demos with explicit provider API key input. This is **not production-safe**.
- **Provider author**: start from the provider contract in `@ongkirhub/core` and use the provider authoring docs plus `mock` or `manual` as references.

## Real provider setup

### RajaOngkir

Add `rajaongkir` to `ENABLED_PROVIDERS` and set RajaOngkir credentials. The location dataset ships compiled inside `@ongkirhub/provider-rajaongkir` so there is no YAML parsing at API startup.

```bash
export ENABLED_PROVIDERS=mock,rajaongkir
export RAJAONGKIR_API_KEY=your-api-key
export RAJAONGKIR_COURIERS=jne,pos
# optional:
# export RAJAONGKIR_INTERNATIONAL_COURIERS=pos,slis,expedito,ray
# export RAJAONGKIR_BASE_URL=https://rajaongkir.komerce.id/api/v1
pnpm dev
```

**Courier lists**

- `RAJAONGKIR_COURIERS` is the default courier list used for all routes.
- `RAJAONGKIR_INTERNATIONAL_COURIERS` is an optional override used only for international routes (`ID` origin -> non-`ID` destination).
- If `RAJAONGKIR_INTERNATIONAL_COURIERS` is not set, international routes fall back to `RAJAONGKIR_COURIERS`.

**Route behavior**

| Route | Origin | Destination | Upstream path |
| --- | --- | --- | --- |
| Domestic | `ID` | `ID` | `POST /calculate/domestic-cost` |
| International | `ID` | non-`ID` | `POST /calculate/international-cost` |
| Unsupported | non-`ID` | any | Rejected with `UNSUPPORTED_ROUTE` |

**International destination input**

For international quotes, the destination only needs `countryCode`:

```json
{
  "destination": {
    "method": "location",
    "countryCode": "MY"
  }
}
```

The provider resolves the country code to the RajaOngkir country ID internally. No postal code or city hierarchy is required for international destinations.

**Ambiguous location escape hatch**

By default, RajaOngkir rejects requests when a postal code or hierarchy match is ambiguous. Set `RAJAONGKIR_UNSAFE_ALLOW_AMBIGUOUS_BEST_MATCH=1` only if you explicitly accept the risk of incorrect origin/destination resolution:

```bash
export RAJAONGKIR_UNSAFE_ALLOW_AMBIGUOUS_BEST_MATCH=1
```

- disabled by default
- provider-local to RajaOngkir
- not recommended for production checkout flows

### Biteship

Add `biteship` to `ENABLED_PROVIDERS` and set Biteship credentials:

```bash
export ENABLED_PROVIDERS=mock,biteship
export BITESHIP_API_KEY=your-api-key
export BITESHIP_COURIERS=jne,sicepat
# optional:
# export BITESHIP_BASE_URL=https://api.biteship.com
pnpm dev
```

Biteship v0.1 uses **postal code lookup** for origin and destination. The request must include `postalCode` on both `origin` and `destination`. Non-Indonesia routes are rejected with `UNSUPPORTED_ROUTE`.

### Location behavior note

Providers do not all accept the same kind of location input:

- RajaOngkir relies on hierarchy and provider-owned mapping data
- Biteship currently relies on postal code lookup

OngkirHub normalizes the request contract, but frontend address-entry and refinement UX still belong to the consuming application. OngkirHub stops at quote success or structured error; applications decide how to collect better location input, retry, or remediate provider-specific failures.

### Provider debug mode

Set `<PROVIDER>_DEBUG=1` to enable provider-local request/response diagnostics:

```bash
export RAJAONGKIR_DEBUG=1
export BITESHIP_DEBUG=1
```

- disabled by default
- API keys and auth headers are never logged
- `/v0/quotes` responses include `debug.<providerKey>` when provider debug mode is enabled

## Packages

| Package | Purpose |
| --- | --- |
| `@ongkirhub/core` | Domain types, provider contract, validation, errors |
| `@ongkirhub/runtime` | Provider orchestration, quote aggregation, health (current alpha) |
| `@ongkirhub/api` | Optional HTTP API adapter over runtime |
| `@ongkirhub/client` | Framework-agnostic TypeScript client for the OngkirHub API |
| `@ongkirhub/react` | Runtime-oriented React provider and hooks |
| `@ongkirhub/react-api` | HTTP-oriented React hooks and provider for the OngkirHub client |
| `@ongkirhub/provider-mock` | Deterministic development provider |
| `@ongkirhub/provider-manual` | Configurable static-rate provider |
| `@ongkirhub/provider-rajaongkir` | RajaOngkir domestic and international rates |
| `@ongkirhub/provider-biteship` | Biteship courier aggregator rates |
| `@ongkirhub/location-google` | Google Places location normalization (optional) |

Dependency direction:

- `@ongkirhub/client` depends on `@ongkirhub/core`
- `@ongkirhub/react` depends on `@ongkirhub/runtime` and `@ongkirhub/core`
- `@ongkirhub/react-api` depends on `@ongkirhub/client` and `@ongkirhub/core`
- providers depend on `@ongkirhub/core` only, never on `@ongkirhub/api`

## Examples

The examples are listed from the primary runtime-first path to the optional HTTP/browser adapter path.

### Client smoke example

A minimal runnable example lives in `examples/client-smoke`:

```bash
cd examples/client-smoke
ONGKIRHUB_API_URL=http://localhost:3000 npx tsx src/index.ts
```

It demonstrates `getHealth()` and `getQuotes()` against a configurable API URL.

### Runtime smoke example

A minimal embedded-runtime example lives in `examples/runtime-smoke`:

```bash
cd examples/runtime-smoke
pnpm start
```

It demonstrates `createOngkirHub()` with local providers (`mock` + `manual`), calling `hub.getQuotes()` directly with no HTTP server.

### React server-side runtime example

A minimal server-rendered React example lives in `examples/react-server-runtime`:

```bash
cd examples/react-server-runtime
pnpm start
```

It demonstrates importing `@ongkirhub/runtime` directly in a server-side React script, fetching quotes, and rendering them with `react-dom/server`. No HTTP server or React hook package is involved.

This is the intended runtime-first React path for server environments (Next.js RSC, Remix loaders, etc.).

### React browser demo

A tiny Vite-based React demo lives in `examples/react-demo`:

```bash
cd examples/react-demo
npx vite
```

The dev server proxies API requests to `localhost:3000`, so the demo stays same-origin during local development. It demonstrates `OngkirHubProvider`, `useShippingQuotes()`, and observable loading/success/error states with known-good sample routes.

This is the browser React path. Browser apps cannot access `@ongkirhub/runtime` directly and must use the HTTP API via `@ongkirhub/react-api`.

### React runtime browser demo

A browser-testable runtime demo lives in `examples/react-runtime-demo`:

```bash
cd examples/react-runtime-demo
npx vite
```

It demonstrates `@ongkirhub/react` with providers constructed directly in the browser. **This is demo-only and not production-safe** — API keys are entered in the browser and exposed to the client. It is useful for evaluating provider behavior without a backend.

### React Google Maps location-selection demo

A product-validation demo lives in `examples/react-google-maps-demo`:

```bash
cd examples/react-google-maps-demo
npx vite
```

It uses Google Places Autocomplete to let users pick origin and destination addresses, normalizes the selected places into OngkirHub `LocationInput`, and fetches quotes via `@ongkirhub/react-api`. It is useful for exploring location-selection UX, not as a final merchant-ready flow.

This demo is a reference/example integration only. It does not define an official OngkirHub frontend location strategy.

### React Google Maps runtime demo

A runtime-oriented variant lives in `examples/react-google-maps-runtime-demo`:

```bash
cd examples/react-google-maps-runtime-demo
npx vite
```

It combines Google Places Autocomplete with `@ongkirhub/react` running providers directly in the browser. **Demo-only and not production-safe** — provider API keys are entered in the browser.

## Onboarding notes

If you are evaluating OngkirHub for adoption:

1. start with `examples/runtime-smoke` to validate the embedded runtime contract
2. enable RajaOngkir or Biteship in runtime or API mode to validate a real provider path
3. use `examples/client-smoke` or `examples/react-demo` only if you specifically want to evaluate the optional HTTP/browser adapter path
4. read provider-specific limits before assuming all providers support the same routes or location inputs

## Project status

v0.1 is the first OSS wave: a small pnpm monorepo focused on quote normalization and provider extensibility. See [ROADMAP.md](./ROADMAP.md) for what comes next.

## Documentation

- [Architecture](./docs/architecture.md)
- [API v0.1](./docs/api-v0.1.md)
- [Provider authoring](./docs/provider-authoring.md)
- [Contributing](./CONTRIBUTING.md)
