# React Runtime Architecture Brief

## Context

OngkirHub has committed to a **framework-first, API-second** direction. `@ongkirhub/runtime` now exists as a shipped alpha surface, and `@ongkirhub/react` has been implemented as a runtime-oriented React package. The HTTP-oriented React package (`@ongkirhub/react-api`, formerly `@ongkirhub/react`) was built during the earlier HTTP-first phase and still assumes an HTTP/client boundary.

This brief documents the current React package landscape: when to use `@ongkirhub/react` (runtime-oriented) vs `@ongkirhub/react-api` (HTTP-oriented), and what boundaries each package respects.

---

## 1. Two different models

The phrase "runtime-oriented React" actually describes two very different things:

### Model A: Server-only runtime usage

React frameworks (Next.js App Router, Remix) execute code on the server. In those environments, `@ongkirhub/runtime` can be imported and used directly.

```tsx
// Next.js Server Component
import { createOngkirHub } from "@ongkirhub/runtime";
import { mockProvider } from "@ongkirhub/provider-mock";

export default async function QuotePage() {
  const hub = createOngkirHub({ providers: [mockProvider] });
  const { quotes } = await hub.getQuotes(request);
  return <QuoteList quotes={quotes} />;
}
```

Characteristics:
- No React context or provider needed
- No `isLoading` / `refetch` state management needed
- Data is fetched before the component renders
- Just import `@ongkirhub/runtime` directly

### Model B: Client-style React hook usage

A traditional Provider + `useShippingQuotes()` hook that holds an `OngkirHub` instance in React context and manages reactive fetch states.

Characteristics:
- Needs a live `OngkirHub` instance accessible to the React renderer
- Requires `useEffect`, `useState`, loading/error/success states
- Makes sense only where the React app itself runs in a Node.js-capable environment

---

## 2. Where can each model actually run?

| Environment | Model A (server-only) | Model B (client hooks) |
|-------------|----------------------|------------------------|
| Next.js App Router (RSC) | ✅ Direct runtime import | ❌ Anti-pattern; RSCs fetch once, not reactively |
| Next.js Pages Router | ✅ Runtime in `getServerSideProps` / API routes | ❌ No runtime access in browser bundle |
| Remix | ✅ Runtime in loaders / actions | ❌ No runtime access in browser bundle |
| Browser (Vite, CRA) | ❌ No Node.js / secrets | ❌ No runtime access at all |
| Electron / Tauri | ✅ Runtime in main process | ⚠️ Possible via IPC or direct import, but niche |
| React Native | ❌ Node.js deps often fail | ❌ Same constraints |

**Key insight:**

- **Model A** works in every server-side React framework today. It requires **no dedicated React package** — just use `@ongkirhub/runtime` directly.
- **Model B** is viable only in Electron/Tauri-style desktop apps where the renderer has Node.js access. This is a narrow niche.

---

## 3. Is a runtime-oriented React package justified now?

**No.**

### For server-side React: not needed

Server Components, loaders, and server actions should import `@ongkirhub/runtime` directly. A Provider + `useShippingQuotes` wrapper would be an unnecessary abstraction that:

- Adds a client-side pattern (context, `useEffect`) to a server-side execution model
- Introduces reactive state management where none is needed
- Creates confusion about whether the code runs on server or client

### For browser React: not possible

The browser cannot execute providers (API secrets, Node.js SDKs, provider-specific dependencies). Browser React must continue to use the HTTP path: `@ongkirhub/client` + `@ongkirhub/react-api`.

### For Electron / desktop: niche, defer

A Provider + hook around `OngkirHub` could make sense in a desktop app where the React renderer has direct Node.js access. But:

- This is a narrow use case
- Most Electron apps use IPC to call the main process anyway
- No current demand or validated need

**Recommendation:** `@ongkirhub/react` now exists for runtime-oriented React usage. It is currently positioned for alpha/demo/server-side usage where the React app has direct access to the runtime. The correct server-side path is still to import `@ongkirhub/runtime` directly when a React wrapper is unnecessary.

---

## 4. What the current React package actually is

`@ongkirhub/react-api` is an **HTTP-oriented React integration**. It depends on `@ongkirhub/client`, which makes `fetch` calls to an HTTP API. That is the correct and only viable pattern for browser React.

`@ongkirhub/react` now exists as a runtime-oriented React package. It provides `OngkirHubProvider`, `useOngkirHub()`, and `useShippingQuotes()` for environments where the React renderer has direct access to the runtime hub.

---

## 5. Rename recommendation

**The rename has already happened.**

`@ongkirhub/react` was renamed to `@ongkirhub/react-api`, and a new runtime-oriented `@ongkirhub/react` was created to align package discovery with the runtime-first architecture.

That means the current state is:

- `@ongkirhub/react-api` -> HTTP/browser-safe React integration
- `@ongkirhub/react` -> runtime-oriented React integration (alpha, for server-side and demo usage)

### Current naming state

The naming path is now:

```text
@ongkirhub/react-api          -> HTTP-oriented (current)
@ongkirhub/react              -> runtime-oriented (current, alpha)
```

This completed the rename and makes each package's purpose explicit.

---

## 6. What to do now

### Document the server-side path

Make it obvious that server-side React should use `@ongkirhub/runtime` directly. Add to README and architecture docs:

```tsx
// Next.js Server Component — no React package needed
import { createOngkirHub } from "@ongkirhub/runtime";
```

### Keep `@ongkirhub/react-api` as the HTTP React path

`@ongkirhub/react-api` is correctly positioned as the HTTP-oriented React integration. `@ongkirhub/react` is positioned as the runtime-oriented React integration.

### Future trigger for runtime React package

`@ongkirhub/react` already exists. It is useful when:

- Building server-side React apps where a provider + hook abstraction over the runtime hub is convenient
- Building browser demos that explicitly construct providers in the client (not production-safe)
- Building Electron/Tauri apps where the renderer has direct Node.js access

For pure server-side React (RSC, loaders), direct `@ongkirhub/runtime` import remains the simplest path.

---

## 7. Boundary discipline

Regardless of whether a runtime React package is created later, the existing product boundary stays intact:

- **No Google-aware hooks.** Location input is plain `LocationInput`.
- **No provider-selection UI abstractions.** The app decides which providers to request.
- **No candidate-selection logic.** The package returns quotes; ranking/filtering is the app's job.
- **No checkout drift.** The package stops at quote execution.

---

## 8. Risks and tradeoffs

| Risk | Mitigation |
|------|-----------|
| Users assume `@ongkirhub/react` is production-safe in the browser | Document clearly: `@ongkirhub/react` requires runtime hub access; browser production apps should use `@ongkirhub/react-api` with a backend |
| Framework-first messaging feels weak without a runtime React package | Direct runtime import in RSC is actually *more* framework-first than a wrapper package |
| Future Electron demand | `@ongkirhub/react` already supports this use case |

---

## Summary

- **Server-side React:** Import `@ongkirhub/runtime` directly, or use `@ongkirhub/react` when a provider/hook abstraction is convenient.
- **Browser React (production):** Use `@ongkirhub/react-api` (HTTP-oriented) with a backend server.
- **Browser React (demo/evaluation):** `@ongkirhub/react` can be used for browser demos with explicit provider API key input. This is **not production-safe**.
- **Rename:** completed. `@ongkirhub/react-api` is the HTTP package; `@ongkirhub/react` is the runtime package.
