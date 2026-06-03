# International Destination Validation Review

**Date:** 2026-06-03  
**Scope:** Review the conflict between shared location validation and international destination requirements  
**Constraint:** No code changes in this review.

---

## Current Rule

The shared `LocationInput` validation enforces this minimum rule on **both origin and destination**:

> Every location must include **either** `postalCode` **or** both `level1` and `level2`.

This rule exists in two places:

1. **API layer** (`apps/api/src/schemas/quote-request.ts` — Zod `locationInputSchema`)
2. **Core layer** (`packages/core/src/location/input.ts` — `validateLocationInput()`)

The rule was designed for domestic Indonesia shipping, where subdistrict-level or postal-code-level precision is required by all known providers.

---

## Why It Breaks International

RajaOngkir international resolves destinations **at country-level only**. A request like:

```json
{
  "destination": {
    "method": "location",
    "countryCode": "MY"
  }
}
```

is conceptually valid because:

- RajaOngkir international maps `countryCode` → numeric country ID internally
- No city, district, or postal code is needed for the upstream `POST /calculate/international-cost` endpoint
- The provider already has its own `resolveCountryId()` that validates supported countries

But the shared validation layer rejects this **before the provider ever runs**, returning:

```json
{
  "error": "Validation failed",
  "details": {
    "fieldErrors": {
      "destination": ["must include postalCode or both level1 and level2"]
    }
  }
}
```

This is a framework-level minimum that is stricter than at least one real provider path.

---

## Candidate Fixes

### Option A: Relax Global Validation (allow `countryCode`-only everywhere)

**Change:** Remove the `postalCode || (level1 && level2)` requirement entirely. Allow `countryCode`-only for both origin and destination.

**Correctness:** Functionally correct. Providers that need more precision will reject insufficient input themselves.

**Architecture impact:** Low. Removes a shared rule.

**Risk of weakening domestic validation:** Medium. Domestic requests with only `countryCode` would now pass the API layer and fail later inside the provider. The error shifts from a structured 400 validation response to a 502 provider error. For API consumers, this is a worse experience for malformed domestic requests.

**Complexity:** Low. Simple deletion.

### Option B: Route-Aware / Provider-Aware Validation

**Change:** Keep the current default rule, but skip the strict check when the selected providers and route type make `countryCode`-only sufficient.

**Correctness:** Theoretically the most correct. Validates exactly what the request needs.

**Architecture impact:** High. The validation layer currently runs **before** providers are resolved in the API flow:

```
1. Parse JSON body
2. Zod schema validation  ← validation happens here
3. validateQuoteRequest()  ← and here
4. Resolve providers      ← providers known only after this
5. Call provider.getQuotes()
```

Reordering so providers are known before validation would require restructuring the API request pipeline. Alternatively, the Zod schema would need to accept loose input and a second validation pass would run post-provider-resolution. Both add significant complexity.

**Risk of weakening domestic validation:** Low (if implemented correctly). But the complexity cost is high.

**Complexity:** High. Requires restructuring the API validation flow or adding a second validation pass.

### Option C: Shared Destination-Only Validation Relaxation (recommended)

**Change:** Modify the shared validation rule so destination minimum becomes `countryCode`-only, while origin minimum stays at `postalCode || (level1 && level2)`. Providers remain responsible for enforcing their own semantic requirements beyond the shared minimum.

**Correctness:** Correct for the common case. The shared layer enforces a lower floor; providers enforce their own ceilings. Origin is always stricter (you must know where a package ships from). Destination may be country-only for international.

**Architecture impact:** Low. Adjusts one shared rule in both the Zod schema and core validator. Keeps the clean separation where providers validate provider-specific requirements.

**Risk of weakening domestic validation:** Low-to-medium. Domestic providers (RajaOngkir domestic, Biteship) already throw `LOCATION_NOT_FOUND` when they cannot resolve a destination. The error code and message are clear. The only degradation is moving from a 400 validation error to a 502 provider error for malformed domestic requests.

**Complexity:** Low. A targeted rule change: destination minimum becomes `countryCode`; origin minimum stays `postalCode || (level1 && level2)`.

### Comparison

| Option | Correctness | Arch Impact | Domestic Risk | Complexity |
|--------|-------------|-------------|---------------|------------|
| A — Relax globally | ✅ | Low | Medium (both origin and destination weakened) | Low |
| B — Provider-aware | ✅✅ | High | Low | High |
| C — Shared destination-only relax | ✅ | Low | Low-Medium (only destination weakened) | Low |

---

## Recommendation

**Option C: Shared destination-only validation relaxation.**

Rationale:

1. **This is a targeted shared-rule change** — The relaxation happens in the shared validation layer (`quote-request.ts` and `location/input.ts`), not inside providers. The shared minimum for destination is lowered; providers still enforce their own specific requirements.

2. **Origin always needs precision** — A shipment must have a specific origin (warehouse, store, address). Country-only origin is never sufficient in practice. Keeping origin strict is correct.

3. **Destination may be coarse** — International shipping to some providers genuinely only needs a country. The provider already has the right error code (`LOCATION_NOT_FOUND`) for unsupported countries.

4. **Avoids pipeline restructuring** — Unlike Option B, this does not require reordering validation and provider resolution in the API layer.

5. **Lower risk than Option A** — Only destination is relaxed, not origin. Domestic origin validation remains intact.

6. **Shared layer enforces floor, providers enforce ceiling** — The shared rule guarantees `countryCode` is present. Providers then validate whether `postalCode`, `level1`-`level4`, or just `countryCode` is sufficient for their specific upstream API.

**Proposed rule change:**

```
Origin minimum:    countryCode + (postalCode OR (level1 AND level2))
Destination minimum: countryCode alone is sufficient
```

Both origin and destination still require `countryCode`.

---

## What Not To Do

1. **Do not weaken origin validation** — Origin should still require `postalCode` or `level1`+`level2`. Country-only origin is not a real use case.

2. **Do not add provider-specific fields to `LocationInput`** — The shared input contract should remain provider-agnostic. No `providerId`, `rajaongkirCountryId`, or similar fields.

3. **Do not bypass validation entirely in the API layer** — `countryCode` should still be required. The relaxation should be targeted, not a free-for-all.

4. **Do not implement provider-aware validation at the framework level** — The complexity of plumbing provider selection before validation outweighs the benefit. Providers are the right place for provider-specific sufficiency checks.

5. **Do not duplicate the rule in both Zod and core with different behavior** — If the rule changes, both `quote-request.ts` and `location/input.ts` must be updated consistently.
