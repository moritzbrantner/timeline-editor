# Timeline Workbench

`TimelineWorkbench` layers editing UI over the pure document operations. It
includes undo/redo, copy/cut/paste, split, duplicate, group/ungroup, marker
creation, track context actions, tool selection, configurable hotkeys, an
inspector, and snap-aware asset insertion.

Hosts can control document, selection, viewport, clipboard, hotkeys, snap state,
tool state, and history independently. If `history` is provided, undo/redo and
command application use that controlled history and report changes through
`onHistoryChange`. If it is omitted, the workbench keeps history internally.

Workbench assets are descriptive source records. Insertion resolves a compatible
unlocked track by `kind` and creates a timeline item unless `onAssetInsert` is
provided, in which case the host owns insertion.

File import is also host-owned. `TimelineWorkbench` exposes selected `File`
objects through `onImportAssets`, but it does not import browser files by itself.
For audio imports, `createTimelineAudioFileAsset(file)` from
`@moritzbrantner/timeline-editor/audio` creates an `audio` asset with source
metadata and a playable object URL. Keep the returned cleanup callback and
revoke it when the imported source is no longer used.

When `createTimelineAudioExtension()` is included in `extensions`, the preview
panel renders native browser audio controls for selected or active audio items
that include `data.source.uri`.

Empty states must expose document state, provide a concrete action, or be
omitted. Avoid placeholder panels that only explain obvious UI behavior.
