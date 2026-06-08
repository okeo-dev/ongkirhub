# Contributing

Thanks for helping improve OngkirHub.

## Local setup

1. Install Node.js 20+ and pnpm 9.
2. Clone the repository.
3. Run:

```bash
pnpm install
pnpm build
pnpm test
pnpm dev
```

## Development commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the API app with reload |
| `pnpm build` | Build all workspace packages |
| `pnpm test` | Build then run package tests |
| `pnpm typecheck` | Typecheck all packages |
| `pnpm lint` | Typecheck-based lint pass |

## Pull requests

- Keep changes within the stated roadmap phase scope.
- Add or update tests for behavior changes.
- Run `pnpm build`, `pnpm test`, and `pnpm typecheck` before opening a PR.
- Add a changeset when publishing `@ongkirhub/*` packages (including `@ongkirhub/api`).
- `ENABLED_PROVIDERS` must list valid provider keys (`mock`, `manual`, `rajaongkir`, `biteship`); typos fail at startup.

See the PR template for the v0.1 scope checklist.
