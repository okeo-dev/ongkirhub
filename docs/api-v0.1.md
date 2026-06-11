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
| `items` | array of item objects | No |
| `metadata` | object | No |

`declaredValue` at the shipment level is retained for compatibility and future use, but it is **not the primary alpha international path**. For international quotes, use `items[].declaredValue` instead.

`items` is an optional array of line-item customs data. When provided, each item must include:
- `description` (string)
- `quantity` (positive integer)
- `weightGrams` (positive number)
- `declaredValue` (optional `{ amount, currency }`)
- `hsCode` (optional string)
- `originCountryCode` (optional string)

Provider-specific extensions should use `metadata.<providerKey>`.

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

**Origin validation rule:** The `origin` location must include either `postalCode` or both `level1` and `level2`. The `destination` location has no additional validation beyond `countryCode`.

**Not accepted in v0.1:** `method: "coordinate"`. Requests with coordinate input should receive a clear client error until a reverse geocoding resolver is configured and covered by contract tests. No half-supported coordinate mode.

**Resolution failures** (normalized provider/core errors, surfaced as appropriate HTTP status):

| Code | Meaning |
| --- | --- |
| `LOCATION_NOT_FOUND` | No candidate at acceptable confidence |
| `LOCATION_AMBIGUOUS` | Multiple candidates tie at best score |
| `LOCATION_RESOLVER_NOT_CONFIGURED` | Provider has no mapping/resolver wired |
| `LOCATION_RESOLUTION_FAILED` | Resolver error other than not-found/ambiguous |

These errors are the contract boundary. OngkirHub returns structured failure information; consuming applications decide how to collect a better location, retry, or present remediation UX.

Parcel fields: weight in grams, optional dimensions (see `@ongkirhub/core`).

### Success response

```json
{
  "providers": ["mock"],
  "requestSummary": {
    "origin": { "method": "location", "countryCode": "ID", "postalCode": "11460", "level1": "DKI Jakarta", "level2": "Jakarta Barat" },
    "destination": { "method": "location", "countryCode": "ID", "postalCode": "12240", "level1": "Jawa Barat", "level2": "Bandung" }
  },
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

`requestSummary` echoes the resolved origin and destination `LocationInput` for client convenience.

### Error responses

- `400` validation or unknown provider selection
- `502` provider returned a `ProviderError`
- `503` no providers configured

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `HOST` | `0.0.0.0` | Bind host |
| `ENABLED_PROVIDERS` | `mock,manual` | Comma-separated provider keys (`mock`, `manual`, `rajaongkir`, `biteship`, `easypost`, `shippo`, `easyship`). Unknown keys cause startup failure. |
| `RAJAONGKIR_API_KEY` | — | Required when `rajaongkir` is enabled. RajaOngkir API key (not returned by `/health`). |
| `RAJAONGKIR_COURIERS` | — | Required when `rajaongkir` is enabled. Comma-separated courier codes (for example `jne,pos`). |
| `RAJAONGKIR_BASE_URL` | RajaOngkir default | Optional upstream base URL override when `rajaongkir` is enabled. |
| `BITESHIP_API_KEY` | — | Required when `biteship` is enabled. Biteship API key. |
| `BITESHIP_COURIERS` | — | Required when `biteship` is enabled. Comma-separated courier codes (for example `jne,sicepat`). |
| `BITESHIP_BASE_URL` | Biteship default | Optional upstream base URL override when `biteship` is enabled. |
| `EASYPOST_API_KEY` | — | Required when `easypost` is enabled. EasyPost API key. |
| `EASYPOST_CARRIERS` | — | Optional when `easypost` is enabled. Comma-separated carrier names to filter rates (for example `USPS,UPS`). If omitted, all available carriers are returned. |
| `EASYPOST_BASE_URL` | `https://api.easypost.com/v2` | Optional upstream base URL override when `easypost` is enabled. |
| `EASYPOST_DEBUG` | — | Optional. Set to `1` or `true` to enable EasyPost request/response diagnostics. |
| `SHIPPO_API_KEY` | — | Required when `shippo` is enabled. Shippo API key. |
| `SHIPPO_CARRIERS` | — | Optional when `shippo` is enabled. Comma-separated carrier names to filter rates (for example `USPS,UPS`). If omitted, all available carriers are returned. |
| `SHIPPO_BASE_URL` | `https://api.goshippo.com` | Optional upstream base URL override when `shippo` is enabled. |
| `SHIPPO_DEBUG` | — | Optional. Set to `1` or `true` to enable Shippo request/response diagnostics. |
| `EASYSHIP_API_KEY` | — | Required when `easyship` is enabled. Easyship API key. |
| `EASYSHIP_CARRIERS` | — | Optional when `easyship` is enabled. Comma-separated carrier names to filter rates. |
| `EASYSHIP_BASE_URL` | `https://public-api.easyship.com` | Optional upstream base URL override when `easyship` is enabled. |
| `EASYSHIP_DEBUG` | — | Optional. Set to `1` or `true` to enable Easyship request/response diagnostics. |

When `rajaongkir` is listed in `ENABLED_PROVIDERS`, missing `RAJAONGKIR_API_KEY` or `RAJAONGKIR_COURIERS` fails API startup immediately. When `biteship` is listed, missing `BITESHIP_API_KEY` fails startup. When `easypost` is listed, missing `EASYPOST_API_KEY` fails startup. When `shippo` is listed, missing `SHIPPO_API_KEY` fails startup. When `easyship` is listed, missing `EASYSHIP_API_KEY` fails startup. Variables for disabled providers are optional.

**EasyPost alpha limitation:** EasyPost is domestic-only in the alpha. Cross-country shipments are rejected with `UNSUPPORTED_ROUTE`. EasyPost international support is not yet implemented.

**Shippo alpha limitation:** Shippo supports domestic quotes out of the box and international quotes via the alpha `request.items` path. Parcels must include `dimensions` (`lengthCm`, `widthCm`, `heightCm`). International requests without `request.items` are rejected with `INVALID_REQUEST`. The current Shippo alpha also relies on provider-local `metadata.shippo` fields for address lines (`originLine1`, `destinationLine1`), phone numbers (`originPhone`, `destinationPhone`), and customs declaration fields (`certify`, `certifySigner`, `contentsType`, `contentsExplanation`, `eelPfc`). Shippo test mode may return placeholder/sample rates; it is useful for integration validation, not for validating real-world shipping prices.

**Easyship alpha limitation:** Easyship supports domestic quotes out of the box and international quotes via the alpha `request.items` path. Parcels must include `dimensions` (`lengthCm`, `widthCm`, `heightCm`). International requests without `request.items` are rejected with `INVALID_REQUEST`. The current Easyship alpha also relies on provider-local `metadata.easyship` fields for address lines (`originLine1`, `destinationLine1`) and rate flags (`incoterms`, `calculateTaxAndDuties`, `setAsResidential`). Provider-specific customs admin (certification, EEI, restrictions) remains intentionally deferred at the shared-contract level.
