# Frontend Ecosystem Architecture

**Date:** 2026-06-03  
**Scope:** Review proposed frontend packages and define implementation brief  
**Constraint:** No code changes in this review.

> Note: this document was written during the HTTP-first frontend package planning phase. Current OngkirHub product direction is runtime-first: `@ongkirhub/runtime` is the primary orchestration surface, while `@ongkirhub/client` and `@ongkirhub/react-api` are optional HTTP/browser adapter packages.

---

## Decision Summary

| Question | Decision |
|----------|----------|
| Should `@ongkirhub/client` exist? | **Yes.** It is the single frontend transport and request-normalization layer. |
| Should `@ongkirhub/react-api` depend on `@ongkirhub/client`? | **Yes.** React consumes the client; it does not duplicate request logic. |
| Should `@ongkirhub/widget` depend on `@ongkirhub/react-api`? | **No.** Widget depends on `@ongkirhub/client` directly to avoid framework lock-in and unnecessary bundle weight. |
| Should these packages live in the monorepo? | **Yes.** |
| v0.1 scope | Build `@ongkirhub/client` first, then headless `@ongkirhub/react-api`. Defer `@ongkirhub/widget`. |

---

## Recommended Package Graph

```text
@ongkirhub/core
  ↓
@ongkirhub/api
  ↓
providers
  ↓
@ongkirhub/client           ← first build
  ↓              ↓
@ongkirhub/react-api  @ongkirhub/widget    ← react second, widget deferred
```

**Dependency rule:**

- `@ongkirhub/react-api` → `@ongkirhub/client`
- `@ongkirhub/widget` → `@ongkirhub/client`
- **No** `@ongkirhub/widget` → `@ongkirhub/react-api` edge

## Boundary guardrail

These frontend packages are intentionally thin.

OngkirHub frontend packages should own:

- typed request/response transport
- loading/error/data state
- request lifecycle helpers

They should **not** own:

- provider-aware frontend refinement strategies
- Google-aware hooks
- candidate-selection abstractions
- checkout-specific remediation flows

Those belong to consuming applications. Demos may show possible integrations, but demos do not define the framework boundary.

---

## Why `@ongkirhub/client` Should Exist

**Yes.** A framework-agnostic TypeScript client is justified because:

1. **Single transport layer** — All frontend packages (React, Vue, Svelte, vanilla JS, widget) should share one HTTP client. Without it, each framework adapter would duplicate fetch logic, error normalization, and retry handling.

2. **Request/response normalization** — The backend returns provider-specific envelopes (`requestSummary`, `debug`, `quotes`). The client normalizes these into a stable shape before framework code sees them.

3. **Error handling boundary** — The client maps HTTP errors (`400`, `502`, network failures) into typed errors that framework hooks can catch consistently.

4. **Testability** — A pure-JS client is easier to unit test than hooks or DOM components. It provides a clear seam for mocking.

The client is **not** a thin wrapper. It owns:
- Request serialization
- Response parsing and normalization
- Retry/timeout policy
- Typed error mapping

The client must **not** grow into address-entry or provider-remediation logic.

---

## Package Responsibilities

### `@ongkirhub/client`

| Responsibility | Owner |
|----------------|-------|
| HTTP transport | ✅ Client |
| Request serialization (JSON, headers) | ✅ Client |
| Response parsing and normalization | ✅ Client |
| Normalized error handling (`ProviderError`, network errors) | ✅ Client |
| Retries / timeouts | ✅ Client |
| Cache key generation | ❌ Deferred to future wave |
| Request deduplication | ❌ Deferred to future wave |

**Public API:**

```ts
export class OngkirHubClient {
  constructor(config: { baseUrl: string; fetchFn?: typeof fetch });
  getQuotes(request: QuoteRequestBody): Promise<QuotesResponseBody>;
  getHealth(): Promise<HealthResponseBody>;
}

export type { QuoteRequestBody, QuotesResponseBody, Quote, ProviderErrorCode };
```

**Internal (not public):**
- Retry policy implementation
- Internal fetch wrapper

### `@ongkirhub/react-api`

| Responsibility | Owner |
|----------------|-------|
| React context / provider | ✅ React |
| Hook exposure (`useOngkirHubClient`, `useShippingQuotes`) | ✅ React |
| Query/state helpers (caching, deduplication, refetch) | ❌ Deferred to future wave |
| Component-level loading/error states | ✅ React |
| HTTP transport | ❌ Delegates to Client |
| Request serialization | ❌ Delegates to Client |
| Response normalization | ❌ Delegates to Client |
| Provider-aware location refinement | ❌ Application concern |

**Public API:**

```tsx
// Provider
export function OngkirHubProvider(props: {
  client: OngkirHubClient;
  children: React.ReactNode;
});

// Hooks
export function useOngkirHubClient(): OngkirHubClient;
export function useShippingQuotes(
  request: QuoteRequestBody,
  options?: { enabled?: boolean; refetchInterval?: number },
): {
  quotes: Quote[];
  providers: string[];
  requestSummary: RequestSummary;
  isLoading: boolean;
  error: OngkirHubError | null;
  refetch: () => void;
};
```

**Internal (not public):**
- Internal state machines for loading/error/data

The React package remains headless and request-oriented. It should not grow Google-aware hooks or provider-specific location-selection helpers.

### `@ongkirhub/widget`

| Responsibility | Owner |
|----------------|-------|
| Browser DOM rendering | ✅ Widget |
| Widget interaction state (open/close, form input) | ✅ Widget |
| Default widget styling | ✅ Widget |
| HTTP transport | ❌ Delegates to Client |
| React hooks / context | ❌ Widget does not depend on React |

**Public API:**

```js
export class OngkirHubWidget {
  constructor(config: {
    apiUrl: string;
    container: string | HTMLElement;
    options?: WidgetOptions;
  });
  mount(): void;
  destroy(): void;
}
```

The widget internally creates and owns its `OngkirHubClient` instance from `apiUrl`. Advanced embedding (dependency injection of a prebuilt client) can be explored in a future wave but is not the default v0.1 public API.

**Internal (not public):**
- DOM structure templates
- CSS-in-JS or inline style generation
- Event listener management

---

## Why `@ongkirhub/widget` Should Not Depend on `@ongkirhub/react-api`

**Recommendation:** `@ongkirhub/widget` → `@ongkirhub/client`, not `@ongkirhub/react-api`.

| Concern | `widget → react` | `widget → client` |
|---------|------------------|-------------------|
| **Bundle size** | Ships React + React DOM + hooks even if host app uses Vue/Svelte/vanilla | Ships only client + widget logic. Minimal overhead. |
| **Framework lock-in** | Widget is a React app injected into a potentially non-React page | Widget is framework-agnostic. Host page is unaffected. |
| **Duplicated state logic** | React hooks manage state; widget may need parallel DOM state | Single state layer inside widget. No duplication. |
| **Long-term maintainability** | React upgrades force widget rebuilds even if widget UI is stable | Widget is decoupled from React release cycle. |
| **Host app conflicts** | Risk of React version mismatch with host app | No React dependency = no version conflict risk. |

**Exception:** If the widget is explicitly designed as a "React component embed" (e.g., for React-based e-commerce platforms like Shopify Hydrogen), a separate `@ongkirhub/react-widget` package could be justified. The default widget should not assume React.

---

## Public API Surface

### `@ongkirhub/client`

| Symbol | Visibility |
|--------|------------|
| `OngkirHubClient` class | **Public** |
| `QuoteRequestBody` type | **Public** |
| `QuotesResponseBody` type | **Public** |
| `Quote` type | **Public** (re-exported from core) |
| `OngkirHubError` class | **Public** |
| `fetchFn` override option | **Public** |
| Retry policy internals | **Internal** |
| Cache key format | **Internal** |

### `@ongkirhub/react-api`

| Symbol | Visibility |
|--------|------------|
| `OngkirHubProvider` | **Public** |
| `useOngkirHubClient` | **Public** |
| `useShippingQuotes` | **Public** |
| Internal state machine | **Internal** |

### `@ongkirhub/widget`

| Symbol | Visibility |
|--------|------------|
| `OngkirHubWidget` class | **Public** |
| `WidgetOptions` type | **Public** |
| `apiUrl` constructor option | **Public** |
| `container` constructor option | **Public** |
| DOM structure / CSS | **Internal** |
| Event handler wiring | **Internal** |
| Internal `OngkirHubClient` instance | **Internal** |

---

## v0.1 Scope

### Workstream 1: `@ongkirhub/client`

**Scope:**

- `OngkirHubClient` class
- `getQuotes()` method with typed request/response
- `getHealth()` method
- Basic retry: 3 attempts, exponential backoff
- Typed error mapping: network, HTTP 4xx/5xx, parse errors
- Custom `fetchFn` injection for testing

**Acceptance criteria:**

1. Client can fetch quotes from a live API instance
2. Client normalizes errors into a typed `OngkirHubError`
3. Client is testable with a mock `fetchFn`
4. No React or DOM dependencies

**Must not implement yet:**

- Caching or cache-key system
- Request deduplication
- Subscription/WebSocket support
- Provider-specific client extensions

### Workstream 2: `@ongkirhub/react-api`

**Scope:**

- `OngkirHubProvider` React context
- `useOngkirHubClient()` hook
- `useShippingQuotes(request, options)` hook with loading/error/data states
- Explicit fetch / refetch behavior via `useEffect` + `useState` (no implicit caching layer)

**Acceptance criteria:**

1. Provider makes client available to child components
2. `useShippingQuotes` returns quotes, loading state, and errors
3. Hook is testable with a mock client
4. No direct `fetch` calls — all transport via client

**Must not implement yet:**

- UI components (buttons, forms, dropdowns)
- Implicit caching or stale-while-revalidate logic
- TanStack Query / SWR integration
- Widget-specific logic

### Workstream 3: `@ongkirhub/widget` (deferred)

**Scope (future):**

- Vanilla-JS widget class
- DOM mounting into a container selector or element
- Default shipping calculator UI (origin, destination, weight input)
- Quote result display
- Basic CSS (inline or injected stylesheet)

**Deferral rationale:**

- Widget UI is the most opinionated layer. It should wait until the client API is stable.
- Widget requires design decisions (CSS framework, form validation, accessibility) that are best made after the data layer is proven.
- Address-entry and refinement UX are application concerns today. Widget work should not force OngkirHub to formalize a checkout/location platform boundary.

---

## Recommended Build Tooling

| Package | Build Tool | Output |
|---------|------------|--------|
| `@ongkirhub/client` | `tsc` | ESM + `.d.ts` |
| `@ongkirhub/react-api` | `tsc` | ESM + `.d.ts` |
| `@ongkirhub/widget` | `tsc` + `esbuild` or `rollup` (deferred) | ESM + IIFE bundle for CDN drop-in |

**Rationale:**

- `tsc` is already used across the monorepo. Consistency matters more than build speed for these packages.
- Widget needs a separate browser bundle step because it may be consumed via CDN as a `<script>` tag. This can be added later without affecting client or react.
- No heavy tooling (Vite, Webpack) unless justified by widget complexity.

---

## Do RajaOngkir and Biteship Change the Recommendation?

**No for package layering.** The existence of dataset-first vs direct-provider resolution does not change the client/react/widget boundary.

**Yes for client error normalization.** The backend now returns:
- `requestSummary` (origin/destination summary)
- `debug` (provider-specific request metadata)
- Provider-level errors (`LOCATION_NOT_FOUND`, `UPSTREAM_UNAVAILABLE`)

This means the client should:

1. **Surface `requestSummary`** in the response type so frontend code can display what was queried
2. **Normalize provider errors** into a stable error shape (code, message, providerKey)

In a future API evolution, the backend may support mixed-provider responses (some providers succeed, others return errors in the same response). If that happens, the client would be the right place to normalize those partial-success payloads. Today, the API returns either a full success or a single error, so the client handles the current contract without assuming partial-success semantics.

These are client-layer concerns, not React or Widget concerns. The React hook simply exposes the normalized result.

---

## Risks and Non-Goals

### Risks

| Risk | Mitigation |
|------|------------|
| Widget CSS conflicts with host page | Use CSS scoping (Shadow DOM or BEM-style prefixed classes) |
| React version mismatch if widget accidentally depends on React | Enforce via lint rule: widget package must not import React |
| Client bundle size bloat | Tree-shakeable ESM exports; no side-effect imports |
| API contract drift between client and backend | Client types derived from API Zod schemas or OpenAPI spec |

### Non-Goals

1. **Do not build a generic HTTP client** — The client is OngkirHub-specific. It knows the `/v0/quotes` endpoint shape.
2. **Do not integrate TanStack Query / SWR yet** — The React hook can use `useEffect` + `useState` in v0.1. External query libraries are a future optimization.
3. **Do not ship styled UI components in `@ongkirhub/react-api`** — React package is headless in v0.1. UI is widget territory.
4. **Do not support SSR in v0.1** — Widget and React hooks assume browser environment. SSR support is a future workstream.

---

## Recommended Implementation Sequence

```
Phase 1: @ongkirhub/client
  ├─ Define public API types
  ├─ Implement OngkirHubClient
  ├─ Implement getQuotes() with retry
  ├─ Implement error normalization
  └─ Write unit tests with mock fetch

Phase 2: @ongkirhub/react-api
  ├─ Implement OngkirHubProvider
  ├─ Implement useOngkirHubClient()
  ├─ Implement useShippingQuotes()
  └─ Write unit tests with mock client

Phase 3: @ongkirhub/widget (deferred)
  ├─ Design DOM contract
  ├─ Implement vanilla-JS widget class
  ├─ Implement default calculator UI
  └─ Build browser bundle
```

---

## Files in This Review

- `docs/frontend-ecosystem-architecture.md` (this document)
