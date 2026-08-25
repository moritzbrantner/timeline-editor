# Source development

Timeline Editor keeps its published semver contract intact while local editor-family development can consume editor-core directly from a sibling checkout.

Default layout:

```text
workspace/
  editor-core/
  timeline-editor/
```

Override the source checkout with `EDITOR_CORE_SOURCE=/absolute/path/to/editor-core`.

```sh
bun run source:prepare
bun run source:status
bun run source:smoke
bun run verify:source
```

`source:prepare` installs frozen dependencies, recursively prepares upstream source dependencies when supported, builds editor-core, then materializes that build into `node_modules/@moritzbrantner/editor-core` under Timeline Editor's expected package identity. The active Git SHA is stored under `node_modules/.editor-source-deps/`; neither `package.json` nor the lockfile becomes a second development manifest.

`source:smoke` proves the selected source build is active and importable. `verify:source` then runs Timeline Editor against that exact revision and intentionally exposes API drift between the older published dependency contract and current editor-core source.

The release/consumer path remains explicit:

```sh
bun run source:restore
bun run verify
```

`verify` restores the frozen registry dependency before running the full release-oriented suite. Source activation and source compatibility are deliberately separate: the former proves the development plumbing; the latter is the migration work performed on top of it.
