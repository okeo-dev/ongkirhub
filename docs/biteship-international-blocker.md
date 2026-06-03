# Biteship International Blocker

**Date:** 2026-06-03  
**Status:** Paused / Unsupported  
**Scope:** Biteship international shipping quotes

---

## Decision

Biteship international implementation is **paused**. The provider supports domestic Indonesia routes only.

## Evidence

Live API probing against Biteship's public endpoints produced these concrete failures:

1. **Rates API with foreign postal code**
   - Request: `POST /v1/rates/couriers` with non-Indonesian destination postal code
   - Response: `Failed due to invalid or missing postal code`

2. **Maps API international area lookup**
   - Request: Area search with `countries=SG` and `countries=MY`
   - Response: `success: true, areas: []` (empty results for both countries)

These results confirm Biteship's documented Maps + Rates path does not currently support non-Indonesian destination resolution.

## Reopen Conditions

Implementation may resume if any of the following occurs:

1. Biteship documents an international rates path in their official API reference
2. Biteship support confirms the correct request shape for international quotes
3. Live API behavior changes to accept international postal codes or return international area results

Until then, `@ongkirhub/provider-biteship` remains domestic-only.
