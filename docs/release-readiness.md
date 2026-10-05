# Release Readiness

## Required Checks

Run these before merging changes to the public package contract:

```sh
bun run verify
```

`bun run verify` covers formatting, linting, typechecking, unit tests, package
tests, Rust tests, Playwright, Lighthouse, Storybook tests, Storybook build,
root and split package builds, wasm build, documented examples, and package
export smoke tests.

## Public API

The release contract is the root export plus `./core`, `./react`, `./commands`,
`./history`, `./serialization`, `./extensions`, `./media-types`,
`./media-import`, `./text`, `./audio`, `./video`, `./image`, and `./data`. Any
added or removed runtime export must be reflected in
`tests/package/export-contract.json`.

Core-only entrypoints must not import React, React JSX runtime, or
`@moritzbrantner/ui` at runtime.

## Release Channels

The root `@moritzbrantner/timeline-editor` package is the stable `1.x` package.
It owns the generic timeline document model, core operations, React timeline,
and workbench APIs.

Split packages under `packages/*` are experimental `0.x` workspace packages. They
provide accelerated and domain-specific entrypoints such as
`@timeline-editor/compute`, `@timeline-editor/audio`,
`@timeline-editor/video`, `@timeline-editor/image`,
`@timeline-editor/captions`, `@timeline-editor/geo`,
`@timeline-editor/data`, and `@timeline-editor/tauri`. Breaking changes are
allowed while these packages remain `0.x`, but public changes must still be
recorded in `CHANGELOG.md`.

The root package must not import split packages. Split packages may depend on
`@timeline-editor/compute` and may peer-depend on the root package.

## Distribution

Packages are not published to npm. Consumers install the root package as a
commit-pinned git dependency
(`git+https://github.com/moritzbrantner/timeline-editor.git#<commit-sha>`, listed
in `trustedDependencies`); its `prepare` script builds `dist` during the install.
`bun run verify:git-install` checks that path.

The split packages were never published to npm and have no separate git
distribution yet: a git URL resolves only the root package. Their manifests stay
packable (`bun run test:package` checks that), so a per-package git or tarball
distribution can be added when a consumer needs one.

Record public changes in `CHANGELOG.md` under `Unreleased`. A commit on `main`
is the release; there is no version-bump or publish workflow.

## Package Layout

The main `@moritzbrantner/timeline-editor` package owns the generic editor and
lightweight root exports. Split workspace packages under `packages/*` provide
optional accelerated domain entrypoints such as `@timeline-editor/compute`,
`@timeline-editor/audio`, `@timeline-editor/video`,
`@timeline-editor/image`, `@timeline-editor/captions`,
`@timeline-editor/geo`, `@timeline-editor/data`, and
`@timeline-editor/tauri`.

Split packages may depend on `@timeline-editor/compute` and peer-depend on the
root package, but the root package must not import split packages. Runtime
exports for split packages are covered by `tests/package/export-contract.json`
and `tests/package/smoke.mjs` after `bun run build:packages`.
