# OngkirHub

Use one quote API contract even when shipping providers use different location IDs, payloads, and response formats.

OngkirHub is an open-source shipping integration framework for teams that want to integrate multiple logistics providers without rewriting their application for each one. It provides a shared provider contract, an HTTP API, a TypeScript client, and React hooks on top of real provider integrations.

```text
Your application
  ↓
@ongkirhub/client or @ongkirhub/react
  ↓
@ongkirhub/api
  ↓
Providers
  ├── RajaOngkir
  ├── Biteship
  ├── Mock
  └── Manual
```

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
- `@ongkirhub/api` HTTP server (`GET /health`, `POST /v0/quotes`)
- `@ongkirhub/client` TypeScript SDK
- `@ongkirhub/react` headless React integration
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

Install and run:

```bash
pnpm install
pnpm dev
```

The API listens on `http://0.0.0.0:3000` by default.

Then send a first successful quote request using the built-in `mock` and `manual` providers:

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

- **Backend/API consumer**: run `@ongkirhub/api`, enable one or more providers, and call `/v0/quotes`.
- **TypeScript or frontend app developer**: start with `@ongkirhub/client`, then use `@ongkirhub/react` for React apps.
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

OngkirHub normalizes the request contract, but provider-compatible location refinement can still differ by provider. This is one of the main active product areas for frontend adoption flows.

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
| `@ongkirhub/api` | Publishable HTTP API and provider registry composition |
| `@ongkirhub/client` | Framework-agnostic TypeScript client for the OngkirHub API |
| `@ongkirhub/react` | Headless React hooks and provider for the OngkirHub client |
| `@ongkirhub/provider-mock` | Deterministic development provider |
| `@ongkirhub/provider-manual` | Configurable static-rate provider |
| `@ongkirhub/provider-rajaongkir` | RajaOngkir domestic and international rates |
| `@ongkirhub/provider-biteship` | Biteship courier aggregator rates |

Dependency direction:

- `@ongkirhub/client` depends on `@ongkirhub/core`
- `@ongkirhub/react` depends on `@ongkirhub/client` and `@ongkirhub/core`
- providers depend on `@ongkirhub/core` only, never on `@ongkirhub/api`

## Examples

### Client smoke example

A minimal runnable example lives in `examples/client-smoke`:

```bash
cd examples/client-smoke
ONGKIRHUB_API_URL=http://localhost:3000 npx tsx src/index.ts
```

It demonstrates `getHealth()` and `getQuotes()` against a configurable API URL.

### React browser demo

A tiny Vite-based React demo lives in `examples/react-demo`:

```bash
cd examples/react-demo
npx vite
```

The dev server proxies API requests to `localhost:3000`, so the demo stays same-origin during local development. It demonstrates `OngkirHubProvider`, `useShippingQuotes()`, and observable loading/success/error states with known-good sample routes.

### React Google Maps location-selection demo

A product-validation demo lives in `examples/react-google-maps-demo`:

```bash
cd examples/react-google-maps-demo
npx vite
```

It uses Google Places Autocomplete to let users pick origin and destination addresses, normalizes the selected places into OngkirHub `LocationInput`, and fetches quotes via `@ongkirhub/react`. It is useful for exploring location-selection UX, not as a final merchant-ready flow.

## Onboarding notes

If you are evaluating OngkirHub for adoption:

1. start with `mock` + `manual` to validate the API contract
2. enable RajaOngkir or Biteship to validate a real provider path
3. use `examples/client-smoke` or `examples/react-demo` to evaluate developer experience
4. read provider-specific limits before assuming all providers support the same routes or location inputs

## Project status

v0.1 is the first OSS wave: a small pnpm monorepo focused on quote normalization and provider extensibility. See [ROADMAP.md](./ROADMAP.md) for what comes next.

## Documentation

- [Architecture](./docs/architecture.md)
- [API v0.1](./docs/api-v0.1.md)
- [Provider authoring](./docs/provider-authoring.md)
- [Contributing](./CONTRIBUTING.md)
