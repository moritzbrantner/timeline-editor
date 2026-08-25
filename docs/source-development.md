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
bun run verify:source
```

`source:prepare` installs frozen dependencies, recursively prepares upstream source dependencies when supported, builds editor-core, then replaces only `node_modules/@moritzbrantner/editor-core` with a symlink to the source checkout. The active Git SHA is stored under `node_modules/.editor-source-deps/`; neither `package.json` nor the lockfile becomes a second development manifest.

Use `bun run source:watch` while actively changing editor-core.

The release/consumer path remains explicit:

```sh
bun run source:restore
bun run verify
```

`verify` restores the frozen registry dependency before running the full release-oriented suite. `verify:source` exercises the local editor-core checkout without requiring publication.
