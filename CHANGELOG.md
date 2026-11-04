# @moritzbrantner/timeline-editor

## Unreleased

### Minor Changes

- Keep timeline track headers visible during horizontal scrolling, clarify active lanes, make default track groups directly collapsible, and show transform keyframe positions on clips without changing interaction ownership or document formats.
- Implement atomic roll trims and adapter-driven slip editing while preserving the existing normal and ripple trim behavior.
- Add atomic multi-item resize operations with shared snapping and clamping, lock and overlap-policy enforcement, and rigid fail-closed behavior when push handling would move selected items independently.
- Add an undoable `resize-items` command that applies the atomic multi-item resize primitive through the shared command/history layer without changing existing single-item pointer resize behavior.
- Meet WCAG 2.5.3 (Label in Name, enforced by axe 4.14's `label-content-name-mismatch`) for clips and track headers. Their accessible name now comes from a visually hidden copy of the item or track label instead of `aria-label`, and the rendered content (default or `renderItem`/`renderTrackHeader`) is `aria-hidden`. Clip metadata stays available as the `title` description, and default track-header metadata (item count, accepted kinds, lock state) is linked with `aria-describedby`. Clips and track headers no longer carry an `aria-label` attribute: query them by role and name (`getByRole("button", { name })`) instead of by label.

- Adopt the shared editor chrome from `@moritzbrantner/ui`. The workbench toolbar is an `EditorToolbar` (one Tab stop with arrow-key navigation, and a single scrolling row on narrow workbenches), and the assets and inspector panels are pixel-sized `EditorPane`s. Panes keep their width while the window resizes, resize by pointer or keyboard, collapse to a rail, and show and hide from new toolbar panel buttons (`Toggle Assets`, `Toggle Inspector`). Workbenches narrower than 768px show them as overlay drawers over the preview and timeline instead of squeezing them next to the timeline, so the side panels are now closed by default at phone widths. The preview/timeline split and timeline gesture ownership are unchanged.
- Add host control of the side panes: `panelLayout`, `defaultPanelLayout`, and `onPanelLayoutChange` (with a `{ paneId, reason }` context, where `reason` is `"resize"`, `"resize-end"`, or `"collapse"`), plus `panelPresentation` (`"auto"`, `"docked"`, or `"overlay"`) and `panelNarrowBreakpoint`. New exported types: `TimelineWorkbenchPaneId`, `TimelineWorkbenchPaneLayout`, `TimelineWorkbenchPanelLayout`, `TimelineWorkbenchPanelLayoutChangeContext`, and `TimelineWorkbenchPanelPresentation`.

### Patch Changes

- Bump `@moritzbrantner/ui` to `2f8da604881d4513ac16ccceea446072d0a59a5d` for the editor pane, toolbar, and inspector primitives. Git consumers update their direct `@moritzbrantner/ui` pin to the same commit.
- Meet WCAG 2.5.3 for default asset cards: their accessible name is the asset label (a visually hidden copy) and the visible card details are its description. Cards rendered with `renderAsset` keep `aria-label`, because custom content may contain its own controls.
- The playground, Storybook, and browser harness generate Tailwind utilities for Timeline Editor's own sources (`examples/timeline-sources.css`); previously utilities used only by this package were silently missing there.
- The toolbar no longer repeats the current time next to the zoom slider (the transport strip shows it), and the zoom slider has the accessible name `Timeline zoom`.
- Document and test the immutable `document.tracks` snapshot contract: editor and workbench lookups, overlaps, and memoized clips are keyed on `document.tracks`, playhead-only updates reuse them, and mutating tracks or items in place is unsupported. Clips no longer re-render on playhead-only updates (10-20x faster scrub ticks with 2,000 mounted clips in the `bun run bench:scrub` Chromium benchmark), and `getItemContextMenuItems` is now called when an item menu opens, from the latest document and selection, instead of for every clip on every render. Opening a menu on an unselected clip describes the selection it commits, and a builder that returns no items suppresses the native browser menu for that clip.
- Make multi-item timeline moves atomic so snapping, timeline-boundary clamping, and track movement preserve the selection's relative layout and fail as a unit when any target track is invalid.
- Make multi-item paste and duplicate operations atomic, preserve relative timeline and track layout, clamp copied selections as one unit, and reject partial incompatible placements.
- Build the package in a `prepare` script so consumers can install it as a commit-pinned git dependency (`git+https://github.com/moritzbrantner/timeline-editor.git#<sha>` listed in `trustedDependencies`).
- Retire npm publishing: remove the changesets Release workflow and its `NPM_TOKEN` use. Releases are commits on `main`.
- Depend on `@moenarch/editor-core` `main` as a commit-pinned git dependency instead of `^0.4.1`. Git consumers also list `@moenarch/editor-core` in `trustedDependencies` so its `prepare` build runs. The workbench uses editor-core's `useControllableEditorState` and `formatEditorShortcutLabel` directly; the local copy and the internal `formatShortcutLabel` wrapper are removed.
- Depend on `@moritzbrantner/ui` 1.x as a commit-pinned git dependency instead of `^0.10.0`, dropping the vulnerable `shadcn > fast-glob > micromatch > braces` chain. Git consumers also list `@moritzbrantner/ui` directly, at the same commit, and in `trustedDependencies`, and apps rendering the React components import `@moritzbrantner/ui/component-sources.css` next to `@moritzbrantner/ui/styles.css`.

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
