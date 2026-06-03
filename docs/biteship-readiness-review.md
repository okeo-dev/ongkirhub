# Biteship Readiness Review

This document freezes the assumptions carried forward from RajaOngkir and defines the validation frame for the second real provider.

---

## Frozen Assumptions

These are locked for the Biteship implementation. Do not reopen them unless a concrete, provable blocker appears.

1. **`getDebugInfo()` stays ad hoc.**
   It remains an optional provider-specific runtime hook. It will not be formalized into `@ongkirhub/core`.

2. **API response-envelope additions are acceptable.**
   `requestSummary` and optional per-provider `debug` metadata at the envelope level are approved patterns.

3. **Dataset tooling does not need standardization yet.**
   Only the provider-owned YAML contract is standardized. Crawl/generation tooling may remain provider-local.

4. **Aliases are assumed good enough for now.**
   Do not redesign alias strategy before Biteship unless a concrete, reproducible matching failure appears.

---

## What Biteship Should Validate

Biteship must confirm or challenge the following architectural hypotheses:

### 1. `LocationInput` model generalizes

RajaOngkir resolved `level4` subdistrict IDs from `level1`–`level4` text input. Biteship should prove the same `LocationInput` contract works without provider-specific additions. If Biteship requires a new input field, that is a shared-contract challenge, not a provider-local workaround.

### 2. Provider-owned YAML remains sufficient

Biteship should build its mapping as provider-local YAML, compile it into `ProviderLocationRecord[]`, and resolve it with the shared resolver. If Biteship needs a fundamentally different mapping shape, that is a schema challenge.

### 3. Resolver/mapping model generalizes

The shared resolver, scoring, and ambiguity rules should handle Biteship records without changes. If Biteship requires different scoring weights or ambiguity logic, that is a core-algorithm challenge.

### 4. API composition stays thin

`apps/api` should register Biteship in `createProviderRegistry` and call `provider.getQuotes()` with no special-case routing. If the API needs provider-specific request handling, that is a composition-layer challenge.

---

## Warning Signs

Treat these as red flags during Biteship implementation. Each one should trigger a pause and architectural review before proceeding.

| Warning sign | Why it matters |
|---|---|
| Pressure to modify `@ongkirhub/core` for provider-specific fields | Core should remain provider-agnostic. Provider-specific needs belong in the provider package. |
| Pressure to introduce a global location database | Each provider owns its mapping. A global registry would break the provider-local boundary. |
| Repeated need for provider-specific API exceptions in shared layers | The API should be a thin composition layer. Provider-specific routing belongs in the provider or registry, not in shared middleware. |
| Alias behavior proving insufficient in a way that changes shared contracts | Aliases are frozen. If Biteship cannot match with aliases + resolver, the problem is either data quality or a real contract gap—but not a reason to redesign aliases ad-hoc. |
| Provider requiring a different `Quote` shape | The `Quote` contract is normalized and shared. Provider-specific metadata belongs in `metadata`, not in new top-level fields. |
| Provider requiring a different leaf level than `level4` | This is expected and acceptable—each provider chooses its own leaf level. But if the provider needs a *new* level beyond `level4`, that is a contract change. |

---

## Decision Gate

Before Biteship code changes begin, confirm:

- [ ] Biteship location resolution can be expressed as `LocationInput` → provider-local `ProviderLocationRecord[]` → shared resolver.
- [ ] Biteship cost API accepts IDs that resolve from the provider's own mapping.
- [ ] No core contract changes are anticipated.

If any gate fails, pause and document the blocker before writing provider code.
