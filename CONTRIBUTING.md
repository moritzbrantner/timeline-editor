# Contributing

## Required Tools

- Bun `1.3.14`
- Rust stable
- Rust `wasm32-unknown-unknown` target
- Playwright Chromium for local browser checks

## Setup

```sh
bun install --frozen-lockfile
rustup target add wasm32-unknown-unknown
bunx playwright install --with-deps chromium
```

## Development Checks

Run these for normal local development and before opening a PR:

```sh
bun run verify:quick
bun run format:check
bun run lint
```

Run the full release-oriented verification before publishing or changing public
package behavior:

```sh
bun run verify
```

## Export Contract

Public runtime exports are snapshot-tested after packages are built. When a
public export intentionally changes, refresh the contract and run the package
checks:

```sh
bun run build:packages
bun run update:export-contract
bun run test:package
```

## Repository Boundaries

- Keep the root package generic.
- Do not add domain-specific behavior to core.
- Do not add empty instructional panels or placeholder-only UI states.
- Add changesets for public package changes.
- Keep public exports reflected in export contract snapshots.
