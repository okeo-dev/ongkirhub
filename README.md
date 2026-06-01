# OngkirHub

OngkirHub is an open-source shipping integration framework for Indonesia-focused logistics. Integrate once against a stable provider contract, then plug in courier adapters without rewriting your application.

## v0.1 scope

Included:

- Normalized **rates and ETA** quotes
- `@ongkirhub/core` provider contract
- `@ongkirhub/api` HTTP server (`GET /health`, `POST /v0/quotes`)
- Reference providers: `mock` (deterministic) and `manual` (configurable static rates)

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
    "origin": { "city": "Jakarta", "province": "DKI Jakarta" },
    "destination": { "city": "Bandung", "province": "Jawa Barat" },
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

Dependency rule: **providers depend on `core` only**, never on `api`.

## Project status

v0.1 is the first OSS wave: a small pnpm monorepo focused on quote normalization and provider extensibility. See [ROADMAP.md](./ROADMAP.md) for what comes next.

## Documentation

- [Architecture](./docs/architecture.md)
- [API v0.1](./docs/api-v0.1.md)
- [Provider authoring](./docs/provider-authoring.md)
- [Contributing](./CONTRIBUTING.md)
