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

The preview panel has three modes. `active-scene` is the default and previews
items active at `document.currentTimeMs`; `selection-first` previews selected
items first and falls back to active items; `mini-timeline` renders a compact
read-only overview with track rows, item bars, and the playhead. Hosts can
control the mode with `previewMode` and observe changes with
`onPreviewModeChange`.

The preview play button is the synchronized workbench transport. Playback
updates `document.currentTimeMs` through `onDocumentChange`, so the main timeline
playhead advances too, and the timeline follows with keep-visible scrolling only
when the playhead approaches or leaves the visible range. Native audio/video
controls rendered by extensions are still independent browser media controls;
they do not drive the synchronized workbench transport.

Empty states must expose document state, provide a concrete action, or be
omitted. Avoid placeholder panels that only explain obvious UI behavior.
