# API v0.1

Base URL (local default): `http://localhost:3000`

## GET /health

Returns service status and registered provider keys.

```json
{
  "status": "ok",
  "version": "0.1.0",
  "providers": ["manual", "mock"]
}
```

## POST /v0/quotes

Request body:

| Field | Type | Required |
| --- | --- | --- |
| `providers` | `string` or `string[]` | No (defaults to all enabled providers) |
| `origin` | `LocationInput` | Yes |
| `destination` | `LocationInput` | Yes |
| `parcels` | array of parcel objects | Yes |
| `totalWeightGrams` | number | Yes |
| `declaredValue` | `{ amount, currency }` | No |
| `metadata` | object | No |

### Location input (`LocationInput`)

Frozen v0.1 contract: **location method only**. Origin and destination use the same shape. Provider-specific location IDs are not accepted on the public API.

```json
{
  "method": "location",
  "countryCode": "ID",
  "postalCode": "11460",
  "level1": "DKI Jakarta",
  "level2": "Jakarta Barat",
  "level3": "Grogol Petamburan",
  "level4": "Tanjung Duren Utara"
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `method` | Yes | Must be `"location"` in v0.1 |
| `countryCode` | Yes | ISO 3166-1 alpha-2 (e.g. `ID`) |
| `postalCode` | No | Strong matching hint; not required globally |
| `level1`–`level4` | No | Provider-neutral free text; semantic-free labels |

**Not accepted in v0.1:** `method: "coordinate"`. Requests with coordinate input should receive a clear client error until a reverse geocoding resolver is configured and covered by contract tests. No half-supported coordinate mode.

**Resolution failures** (normalized provider/core errors, surfaced as appropriate HTTP status):

| Code | Meaning |
| --- | --- |
| `LOCATION_NOT_FOUND` | No candidate at acceptable confidence |
| `LOCATION_AMBIGUOUS` | Multiple candidates tie at best score |
| `LOCATION_RESOLVER_NOT_CONFIGURED` | Provider has no mapping/resolver wired |
| `LOCATION_RESOLUTION_FAILED` | Resolver error other than not-found/ambiguous |

Parcel fields: weight in grams, optional dimensions (see `@ongkirhub/core`).

### Success response

```json
{
  "providers": ["mock"],
  "quotes": [
    {
      "providerKey": "mock",
      "serviceCode": "MOCK_REG",
      "serviceName": "Mock Regular",
      "price": { "amount": 12000, "currency": "IDR" },
      "estimatedDuration": { "value": 2, "unit": "days" }
    }
  ]
}
```

### Error responses

- `400` validation or unknown provider selection
- `502` provider returned a `ProviderError`
- `503` no providers configured

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `HOST` | `0.0.0.0` | Bind host |
| `ENABLED_PROVIDERS` | `mock,manual` | Comma-separated provider keys (`mock`, `manual`, `rajaongkir`). Unknown keys cause startup failure. |
| `RAJAONGKIR_API_KEY` | — | Required when `rajaongkir` is enabled. RajaOngkir API key (not returned by `/health`). |
| `RAJAONGKIR_COURIERS` | — | Required when `rajaongkir` is enabled. Comma-separated courier codes (for example `jne,pos`). |
| `RAJAONGKIR_BASE_URL` | RajaOngkir default | Optional upstream base URL override when `rajaongkir` is enabled. |

When `rajaongkir` is listed in `ENABLED_PROVIDERS`, missing `RAJAONGKIR_API_KEY` or `RAJAONGKIR_COURIERS` fails API startup immediately. When `rajaongkir` is not enabled, those variables are optional.
