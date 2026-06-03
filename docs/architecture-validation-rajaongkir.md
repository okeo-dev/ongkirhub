# Architecture Validation: RajaOngkir (First Real Provider)

This document captures what the RajaOngkir integration revealed about OngkirHub’s architecture before a second real provider (e.g., Biteship) is added.

---

## What Worked

**Provider-local boundaries mostly held.**

Nearly all RajaOngkir-specific logic—crawl script, payload parsing, ID prefixing, endpoint selection, quote normalization—stayed inside `@ongkirhub/provider-rajaongkir`. The main exception was debug support: `apps/api` now performs an optional runtime `getDebugInfo()` check so provider-specific debug metadata can be surfaced in the response envelope without changing the shared `ShippingProvider` contract.

**Core location resolver handled `level4` without surgery.**

`@ongkirhub/core` already supported `level1`–`level4` in `ProviderLocationRecord`, `LocationPathSnapshot`, and the scoring algorithm. The only provider-local change was switching `DISTRICT_LEVEL = 3` to `LEAF_LEVEL = 4` in the RajaOngkir resolver. The shared resolver, scoring, and ambiguity rules did not change.

**Provider-owned mapping + compile pattern proved correct.**

The provider ships:
- a human-auditable `locations.yaml` (source)
- a `compile.ts` step that validates and flattens it into `ProviderLocationRecord[]`
- a generated `locations.generated.ts` consumed at runtime

This meant the API never parses YAML at startup and the provider controls its own ID space.

**Alias system was sufficient for city type normalization.**

RajaOngkir returns city names like `BANDUNG` with a separate `type: "Kota"`. The provider prepends the type (`KOTA BANDUNG`) and generates aliases (`BANDUNG`) at compile time. The shared resolver’s alias matching handled user input without extra core changes.

**Prefixing strategy solved ID collisions.**

RajaOngkir reuses numeric IDs across levels (province 1–34 overlaps with city and district ranges). The provider uses `p{id}`, `c{id}`, `d{id}` for internal uniqueness and strips the prefix before sending the raw ID to the upstream cost API.

---

## What Was Painful

**Live crawl required operational hardening.**

A straightforward script was not enough. The full Indonesia crawl needed:
- checkpoint/resume (`.checkpoint.json`) to survive interruptions
- aggressive rate-limit back-off (30s → 60s → 120s) for `429`
- generic `status >= 500` retry logic for edge/proxy failures (`521`, `522`, etc.)
- base pacing slowed to 2.5s between requests

**Debug visibility required a small API-side escape hatch.**

The core provider contract was intentionally left unchanged, but we still needed a way to surface RajaOngkir-specific debug metadata such as resolved upstream IDs. The chosen approach was an optional runtime `getDebugInfo()` method checked by `apps/api`, rather than a formal shared interface expansion. This worked, but it is still a small provider-aware seam worth revisiting before more providers accumulate similar hooks.

**Payload shape assumptions were wrong.**

The initial crawler assumed hierarchy rows would contain parent reference fields (`province_id`, `city_id`, `district_id`). They do not. The relationship is implied entirely by the endpoint path. This required a mid-crawl correction.

**Endpoint discovery was trial-and-error.**

RajaOngkir exposes `/calculate/district/domestic-cost` and `/calculate/domestic-cost`. The documentation does not make it obvious that subdistrict (`level4`) IDs are rejected by the district endpoint and accepted only by the domestic-cost endpoint. This surfaced only during live smoke testing.

**Quote `description` field is unreliable for display.**

Some RajaOngkir responses return `description: "240"` alongside `service: "Pos Reguler"`. The provider now derives `serviceName` from `${courierName} ${service}` instead of trusting `description`, while keeping the raw `description` in `metadata`.

**Compiled `level4` dataset is large.**

The full subdistrict-level source is significantly larger than the old `level3`-only dataset. That did not force shared-contract changes, but it does mean dataset size and test/runtime memory behavior should be watched as additional providers are added.

---

## What Surprised Us

**Destination IDs are effectively `level4` (subdistrict), not `level3` (district).**

The old assumption was that RajaOngkir cost resolution used district/kecamatan IDs. Live validation proved the usable IDs are subdistrict/kelurahan IDs. This changed the entire leaf level of the dataset.

**Hierarchy endpoints return minimal payloads.**

`GET /destination/city/{province_id}` returns only `{"id": 1, "name": "MATARAM"}`. No `province_id`, no `type` in some cases. The provider must normalize and enrich names locally.

**City `type` is a separate field that must be prepended.**

A city named `BADUNG` with `type: "Kabupaten"` must be rendered as `KABUPATEN BADUNG` for human matching. This is provider-local logic, but it is a non-obvious data-quality step.

**The debug/logging gap was larger than expected.**

Request/response logging was needed for endpoint discovery, but there was no structured debug toggle. A provider-local `RAJAONGKIR_DEBUG=1` flag was added after the fact, gated and safe.

---

## What Core Changes Were NOT Needed

This section is explicit because it validates the v0.1 contract freeze.

| Expected risk | Actual outcome |
|---|---|
| `@ongkirhub/core` quote contract surgery | **None.** `Quote`, `QuoteRequest`, `ShippingProvider` were untouched. |
| Global location database | **None.** Each provider owns its mapping. No canonical ID registry was needed. |
| Provider-specific fields in `LocationInput` | **None.** `level1`–`level4` slots were semantic enough. No `rajaongkirId` field added. |
| API-server-first restructuring | **None.** The API remained a thin composition layer over providers. |
| Core resolver/scoring changes | **None.** The shared algorithm handled `level4` scoring natively. |
| `ProviderLocationMappingDocument` schema changes | **None.** The YAML schema already supported arbitrary depth up to `level4`. |
| `ShippingProvider` interface expansion | **None.** `getQuotes` remained the single integration point. Debug access was added as an optional runtime method, not an interface change. |

---

## Open Questions Before Biteship

1. **Does Biteship also use `level4` IDs for cost calculation, or a different level?** If different, the provider-local resolver pattern still holds, but the leaf-level assumption may vary per provider.
2. **Does Biteship have a crawlable hierarchy API, or is a static mapping sufficient?** RajaOngkir required live crawl; Biteship may not.
3. **Should the `requestSummary` and `debug` envelope pattern be formalized as a shared API response type, or remain ad-hoc per provider?** Currently it is envelope-level and provider-agnostic in structure.
