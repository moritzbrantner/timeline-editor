# @moritzbrantner/timeline-editor

## Unreleased

### Minor Changes

- Implement atomic roll trims and adapter-driven slip editing while preserving the existing normal and ripple trim behavior.
- Add atomic multi-item resize operations with shared snapping and clamping, lock and overlap-policy enforcement, and rigid fail-closed behavior when push handling would move selected items independently.
- Add an undoable `resize-items` command that applies the atomic multi-item resize primitive through the shared command/history layer without changing existing single-item pointer resize behavior.

### Patch Changes

- Make multi-item timeline moves atomic so snapping, timeline-boundary clamping, and track movement preserve the selection's relative layout and fail as a unit when any target track is invalid.
- Make multi-item paste and duplicate operations atomic, preserve relative timeline and track layout, clamp copied selections as one unit, and reject partial incompatible placements.
- Build the package in a `prepare` script so consumers can install it as a commit-pinned git dependency (`git+https://github.com/moritzbrantner/timeline-editor.git#<sha>` listed in `trustedDependencies`).
- Retire npm publishing: remove the changesets Release workflow and its `NPM_TOKEN` use. Releases are commits on `main`.
- Depend on `@moritzbrantner/ui` 1.x as a commit-pinned git dependency instead of `^0.10.0`, dropping the vulnerable `shadcn > fast-glob > micromatch > braces` chain. Git consumers list `@moritzbrantner/ui` in `trustedDependencies` next to this package.

## 1.0.0

### Major Changes

- [`83e1d47`](https://github.com/moritzbrantner/timeline-editor/commit/83e1d4766098b20e8bc81309ad3d9fe61f4db082) - Introduce the v1 timeline editor surface with a package-owned React timeline, multi-selection, commands, history, validation, serialization, marker operations, grouping types, and expanded core document utilities. Remove the old UI timeline adapter helpers in favor of native timeline document APIs.

### Minor Changes

- [`82e11a0`](https://github.com/moritzbrantner/timeline-editor/commit/82e11a010d57907532e32afcf2d8516a59e32b6e) - Add timeline and ruler context menu extension points for empty timeline areas.

- [`44a8425`](https://github.com/moritzbrantner/timeline-editor/commit/44a8425671ef4b75857b9e0b6bd16ee9737e78b6) - Add granular transform keyframe operations, default workbench transform inspector fields, and deeper track-group membership commands.

### Patch Changes

- [`0bc5560`](https://github.com/moritzbrantner/timeline-editor/commit/0bc5560b94e39063636e49fc9ab2e10a424ae1f9) - Document API stability, package layout, persistence recipes, contributor checks, and expose the current timeline editor schema version constant.

## 0.1.1

- Initial public standalone release.
