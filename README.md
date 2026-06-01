# OngkirHub

OngkirHub is an open-source shipping integration framework for Indonesia-focused logistics. Integrate once against a stable provider contract, then plug in courier adapters without rewriting your application.

## v0.1 scope

Included:

- Normalized **rates and ETA** quotes
- `@ongkirhub/core` provider contract
- `@ongkirhub/api` HTTP server (`GET /health`, `POST /v0/quotes`)
- Reference providers: `mock` (deterministic), `manual` (configurable static rates), and optional `rajaongkir` (RajaOngkir domestic rates)

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
| `@ongkirhub/provider-rajaongkir` | RajaOngkir domestic rates (optional, API-composed) |

Dependency rule: **providers depend on `core` only**, never on `api`.

### Enable RajaOngkir (optional)

Add `rajaongkir` to `ENABLED_PROVIDERS` and set RajaOngkir credentials. The location dataset ships compiled inside `@ongkirhub/provider-rajaongkir` (no YAML parsing at API startup).

```bash
export ENABLED_PROVIDERS=mock,rajaongkir
export RAJAONGKIR_API_KEY=your-api-key
export RAJAONGKIR_COURIERS=jne,pos
# optional:
# export RAJAONGKIR_BASE_URL=https://rajaongkir.komerce.id/api/v1
pnpm dev
```

If `rajaongkir` is not listed in `ENABLED_PROVIDERS`, RajaOngkir env vars are not required.

The current RajaOngkir location dataset is a bootstrap artifact. Future dataset refreshes should come from RajaOngkir APIs, not historical local source files.

## Project status

v0.1 is the first OSS wave: a small pnpm monorepo focused on quote normalization and provider extensibility. See [ROADMAP.md](./ROADMAP.md) for what comes next.

## Documentation

- [Architecture](./docs/architecture.md)
- [API v0.1](./docs/api-v0.1.md)
- [Provider authoring](./docs/provider-authoring.md)
- [Contributing](./CONTRIBUTING.md)
