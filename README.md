# OngkirHub

OngkirHub is an open-source shipping integration framework for Indonesia-focused logistics. Integrate once against a stable provider contract, then plug in courier adapters without rewriting your application.

## v0.1 scope

Included:

- Normalized **rates and ETA** quotes
- `@ongkirhub/core` provider contract
- `@ongkirhub/api` HTTP server (`GET /health`, `POST /v0/quotes`)
- Reference providers: `mock` (deterministic), `manual` (configurable static rates), and optional real providers `rajaongkir` (RajaOngkir domestic and international rates) and `biteship` (Biteship courier aggregator)

Not included yet:

- Tracking, booking, labels
- Persistence, caching, queues
- Multi-tenant auth

## Quick start

Requirements: Node.js 20+, pnpm 9.

```bash
pnpm install
pnpm dev
```

The API listens on `http://0.0.0.0:3000` by default.

### Example quote request

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

### Docker (optional smoke test)

```bash
docker build -t ongkirhub .
docker run --rm -p 3000:3000 ongkirhub
```

## Packages

| Package | Purpose |
| --- | --- |
| `@ongkirhub/core` | Domain types, provider contract, validation, errors |
| `@ongkirhub/api` | Publishable HTTP API and provider registry composition |
| `@ongkirhub/provider-mock` | Deterministic development provider |
| `@ongkirhub/provider-manual` | Configurable static-rate provider |
| `@ongkirhub/provider-rajaongkir` | RajaOngkir domestic and international rates (optional, API-composed) |
| `@ongkirhub/provider-biteship` | Biteship courier aggregator rates (optional, API-composed) |

Dependency rule: **providers depend on `core` only**, never on `api`.

### Enable real providers (optional)

#### RajaOngkir

Add `rajaongkir` to `ENABLED_PROVIDERS` and set RajaOngkir credentials. The location dataset ships compiled inside `@ongkirhub/provider-rajaongkir` (no YAML parsing at API startup).

```bash
export ENABLED_PROVIDERS=mock,rajaongkir
export RAJAONGKIR_API_KEY=your-api-key
export RAJAONGKIR_COURIERS=jne,pos
# optional:
# export RAJAONGKIR_INTERNATIONAL_COURIERS=pos,slis,expedito,ray
# export RAJAONGKIR_BASE_URL=https://rajaongkir.komerce.id/api/v1
pnpm dev
```

**Courier lists:**

- `RAJAONGKIR_COURIERS` is the default courier list used for all routes.
- `RAJAONGKIR_INTERNATIONAL_COURIERS` is an optional override used only for international routes (`ID` origin → non-`ID` destination).
- If `RAJAONGKIR_INTERNATIONAL_COURIERS` is not set, international routes fall back to `RAJAONGKIR_COURIERS`.

**Route behavior:**

| Route | Origin | Destination | Path |
|-------|--------|-------------|------|
| Domestic | `ID` | `ID` | `POST /calculate/domestic-cost` |
| International | `ID` | non-`ID` | `POST /calculate/international-cost` |
| Unsupported | non-`ID` | any | Rejected with `UNSUPPORTED_ROUTE` |

**International destination input:**

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

If `rajaongkir` is not listed in `ENABLED_PROVIDERS`, RajaOngkir env vars are not required.

#### Biteship

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

#### Provider debug mode

Set `<PROVIDER>_DEBUG=1` to enable provider-local request/response diagnostics:

```bash
export RAJAONGKIR_DEBUG=1
export BITESHIP_DEBUG=1
```

- Disabled by default.
- When enabled, provider request/response logs are emitted to `stdout` for troubleshooting.
- API keys and auth headers are never logged.
- When enabled, the `/v0/quotes` response envelope includes a `debug.<providerKey>` object with request parameters.

The current RajaOngkir location dataset is a bootstrap artifact. Future dataset refreshes should come from RajaOngkir APIs, not historical local source files.

## Project status

v0.1 is the first OSS wave: a small pnpm monorepo focused on quote normalization and provider extensibility. See [ROADMAP.md](./ROADMAP.md) for what comes next.

## Documentation

- [Architecture](./docs/architecture.md)
- [API v0.1](./docs/api-v0.1.md)
- [Provider authoring](./docs/provider-authoring.md)
- [Contributing](./CONTRIBUTING.md)
