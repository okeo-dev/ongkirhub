# OngkirHub Changelog

## Alpha release

OngkirHub's alpha prerelease is now published on the `alpha` channel.

### Highlights

- `@ongkirhub/runtime`, `@ongkirhub/react`, and `@ongkirhub/react-api` are aligned with the current alpha surface.
- International provider support has been validated for Easyship and Shippo.
- `@ongkirhub/widget` remains private and out of the public release surface.
- The release gate now passes `pnpm build`, `pnpm typecheck`, and `pnpm test` in the current tree.

### Notes

- The repo uses Changesets prerelease mode with the `alpha` tag.
- `apps/api` test execution requires a larger Node heap because it loads the RajaOngkir dataset during the test run.

### Fixed during the release cycle

- `location-google` and `runtime` test discovery were corrected with package-local Vitest configs.
- `provider-rajaongkir` build helper was updated to avoid the earlier `tsx` IPC failure.
- `apps/api` test execution was adjusted to avoid Node heap exhaustion.
