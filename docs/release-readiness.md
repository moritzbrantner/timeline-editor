# Release Readiness

## Required Checks

Run these before publishing:

```sh
bun run verify
bun run test:playwright
```

`bun run verify` covers formatting, linting, typechecking, unit tests, Storybook
tests, Storybook build, package build, documented examples, and package export
smoke tests. Playwright stays separate because browser installation and runtime
cost are meaningful.

## Public API

The release contract is the root export plus `./core`, `./react`, `./commands`,
`./history`, `./serialization`, `./media-types`, `./text`, `./audio`, `./video`,
`./image`, and `./data`. Any added or removed runtime export must be reflected
in `tests/package/smoke.mjs`.

Core-only entrypoints must not import React, React JSX runtime, or
`@moritzbrantner/ui` at runtime.

## Changesets

Pending changesets should describe one coherent release train. A major v1
changeset means later minor or patch entries should be treated as part of that
same release preparation unless the release has already been cut.

## Package Layout

The main `@moritzbrantner/timeline-editor` package owns all public exports. The
private workspace packages under `packages/audio`, `packages/video`, and
`packages/captions` currently re-export media entrypoints for future split
package compatibility. Do not publish those private packages until there is a
concrete need such as independent install requests, heavier optional media
dependencies, or a measured main-package size problem.
