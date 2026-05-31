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
URL import uses the same callback: pass `allowUrlImport` with `onImportAssets`
to expose compact URL controls that emit `TimelineWorkbenchImportSource`
entries with `type: "url"` and a normalized `url`. For audio imports,
`createTimelineAudioFileAsset(file)` from
`@moritzbrantner/timeline-editor/audio` creates an `audio` asset with source
metadata, a playable object URL, and best-effort Web Audio duration, channel,
sample-rate, and waveform metadata. Pass `generateWaveform: false` to skip
browser decoding, or pass `waveform` when the host already has peaks. For video imports,
`createTimelineVideoFileAsset(file)` from
`@moritzbrantner/timeline-editor/video` creates a `video` asset with duration,
dimensions, poster, optional thumbnails, MIME/source metadata, and a playable
object URL. Return the helper result from `onImportAssets` and the workbench
will run its cleanup when those imported sources are no longer mounted. Use
`createTimelineMediaSourceRegistry()` when the host owns source lifetimes
outside the workbench import result.

Track selection is represented with `selection.trackIds`. Selecting a default
track header clears item, marker, and range selection, reports the selected
track through `onSelectedItemChange`, and shows the default track inspector.
The default inspector covers document, track, range, marker, item, and
multi-item states, and track state exposes label, kind, accepted item kinds,
height, lock state, item count, group membership, item selection, lock/unlock,
and deletion actions.

When `createTimelineAudioExtension()` is included in `extensions`, audio items
with `data.source.uri` synchronize through hidden preview media while the
workbench transport is playing. The workbench preview does not render native
audio controls; audio starts with the timeline transport and pauses when the
transport pauses, stops, or ends.

The preview panel has three modes. `active-scene` is the default and previews
items active at `document.currentTimeMs`; `selection-first` previews selected
items first and falls back to active items; `mini-timeline` renders a compact
read-only overview with track rows, item bars, and the playhead. Hosts can
control the mode with `previewMode` and observe changes with
`onPreviewModeChange`.

The compact transport strip is the synchronized workbench transport. Playback
updates `document.currentTimeMs` through `onDocumentChange`, so the main timeline
playhead advances too, and the timeline follows with keep-visible scrolling only
when the playhead approaches or leaves the visible range. Space toggles
play/pause, K pauses, L shuttles forward through 1x/2x/4x, J shuttles backward
through -1x/-2x/-4x, and Shift+L toggles loop playback. Loop uses the selected
range when it spans at least 1ms after clamping to the document; otherwise it
loops the whole document. Forward playback wraps at the selected range end or
document end, and reverse playback wraps at the selected range start or document
start. Video controls remain independent browser media controls; they do not
drive the synchronized workbench transport. Reverse media playback uses
timeline-driven seeking because native negative media playback is not portable.

Hosts can control transport with `transportState`, initialize uncontrolled
transport with `defaultTransportState`, and observe changes with
`onTransportStateChange`. The uncontrolled defaults are paused, `1x`, and loop
off.

The scene compositor renders common image, video, text, and audio items in
layer order for `active-scene` and `selection-first`. Custom items can still use
an extension `renderPreview`; in mixed scenes that custom preview is composed as
a bounded overlay instead of replacing common media layers. If every preview
item belongs to a custom extension, that extension can own the full preview
body.

Empty states must expose document state, provide a concrete action, or be
omitted. Avoid placeholder panels that only explain obvious UI behavior.
