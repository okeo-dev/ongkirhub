# React Runtime Architecture Brief

## Context

OngkirHub has committed to a **framework-first, API-second** direction. `@ongkirhub/runtime` now exists as a shipped alpha surface, but the React package (`@ongkirhub/react`) was built during the earlier HTTP-first phase and still assumes an HTTP/client boundary.

This brief evaluates whether a runtime-oriented React package is justified, distinguishes server-only runtime usage from client-style React usage, and decides whether the current package should be renamed.

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

The browser cannot execute providers (API secrets, Node.js SDKs, provider-specific dependencies). Browser React must continue to use the HTTP path: `@ongkirhub/client` + `@ongkirhub/react`.

### For Electron / desktop: niche, defer

A Provider + hook around `OngkirHub` could make sense in a desktop app where the React renderer has direct Node.js access. But:

- This is a narrow use case
- Most Electron apps use IPC to call the main process anyway
- No current demand or validated need

**Recommendation:** Defer a dedicated runtime-oriented React package. The correct runtime + React story today is "import `@ongkirhub/runtime` directly in your server code."

---

## 4. What the current React package actually is

`@ongkirhub/react` today is an **HTTP-oriented React integration**. It depends on `@ongkirhub/client`, which makes `fetch` calls to an HTTP API. That is the correct and only viable pattern for browser React.

The package name `@ongkirhub/react` is therefore **accurate for its purpose**. It does not need a "runtime" qualifier because the only React integration that ships today is the HTTP one.

---

## 5. Rename recommendation

**Do not rename now.**

The original brief recommended renaming `@ongkirhub/react` → `@ongkirhub/react-api` and creating a new runtime-oriented `@ongkirhub/react`. That recommendation was premature because:

1. The runtime React model is not yet justified (see §3)
2. Renaming the current package would break early adopters for a surface that does not yet exist
3. `@ongkirhub/react` accurately describes the HTTP-oriented package that is the primary React integration today

### If a runtime React package is needed later

If Electron/desktop demand validates Model B, the naming path would be:

```text
@ongkirhub/react              -> stays as HTTP-oriented (current)
@ongkirhub/react-runtime      -> new runtime-oriented package (future)
```

This avoids renaming the existing package and makes the new package's purpose explicit.

---

## 6. What to do now

### Document the server-side path

Make it obvious that server-side React should use `@ongkirhub/runtime` directly. Add to README and architecture docs:

```tsx
// Next.js Server Component — no React package needed
import { createOngkirHub } from "@ongkirhub/runtime";
```

### Keep `@ongkirhub/react` as-is

The current package is correctly positioned as the HTTP-oriented React integration. No rename. No new package.

### Future trigger for runtime React package

Create `@ongkirhub/react-runtime` only when:

- A validated desktop (Electron/Tauri) integration demands it, **or**
- A server-side React framework emerges where reactive hooks around runtime are genuinely useful

Until then, the server-side path is direct runtime usage.

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
| Users assume `@ongkirhub/react` should work with runtime | Document clearly: server React uses runtime directly; browser React uses the HTTP path |
| Framework-first messaging feels weak without a runtime React package | Direct runtime import in RSC is actually *more* framework-first than a wrapper package |
| Future Electron demand | Create `@ongkirhub/react-runtime` then; name is already reserved conceptually |

---

## Summary

- **Server-side React:** Import `@ongkirhub/runtime` directly. No React package needed.
- **Browser React:** Continue using `@ongkirhub/react` (HTTP-oriented). No changes.
- **Runtime React package:** Not justified today. Defer until Electron/desktop demand validates it.
- **Rename:** Do not rename `@ongkirhub/react`. It correctly names the HTTP-oriented React integration that is the primary surface today.
