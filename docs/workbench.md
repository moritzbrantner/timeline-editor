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
entries with `type: "url"` and a normalized `url`. For common audio, video, and
image imports, use one shared source library with the unified resolver:

```tsx
import {
  TimelineWorkbench,
  createTimelineMediaImportResolver,
  createTimelineMediaSourceLibrary,
} from "@moritzbrantner/timeline-editor";

const sourceLibrary = createTimelineMediaSourceLibrary();

<TimelineWorkbench
  onImportAssets={createTimelineMediaImportResolver({ sourceLibrary })}
  // ...
/>;
```

Call `sourceLibrary.dispose()` when the editing session is destroyed. The source
library keeps object URLs alive while hosts retain them and makes cleanup
idempotent. Lower-level helpers are still available:
`createTimelineAudioFileAsset(file)` from
`@moritzbrantner/timeline-editor/audio`, `createTimelineVideoFileAsset(file)`
from `@moritzbrantner/timeline-editor/video`, and
`createTimelineImageFileAsset(file)` from
`@moritzbrantner/timeline-editor/image`. Return helper results from
`onImportAssets` and the workbench will run their cleanup when those imported
sources are no longer mounted. Use `createTimelineMediaSourceRegistry()` for
older host code that owns source lifetimes outside the workbench import result.
`onImportAssets` receives an optional second argument with an `AbortSignal`,
`onProgress`, and `onWarning`. Hosts can ignore it, or use it to report
per-source progress and recoverable warnings. The assets panel surfaces progress,
warnings, failed source details, and a cancel action while an import is active.

Hosts that need heavier import analysis can use split packages and pass a
shared compute backend:

```ts
import { createTimelineAdaptiveBackend } from "@timeline-editor/compute";
import { createTimelineTauriBackend } from "@timeline-editor/tauri";
import {
  createTimelineAudioBrowserBackend,
  createTimelineAudioFileAsset,
} from "@timeline-editor/audio";

const backend = createTimelineAdaptiveBackend({
  tauri: isTauri ? createTimelineTauriBackend({ invoke }) : undefined,
  browserWasm: createTimelineAudioBrowserBackend(),
});

const result = await createTimelineAudioFileAsset(file, { backend });
```

The same task contract is used for browser workers and Tauri Rust commands.
When no backend supports a task, split packages fall back to the lightweight
root helper behavior or return typed warnings with the import result.

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
start. Scene preview audio and video are owned by the workbench transport, so
native media controls are omitted from the scene compositor and browser media
events do not drive `document.currentTimeMs`. Detail and extension preview
players may still expose browser controls for inspection. Browser autoplay
restrictions and source failures are surfaced in preview as blocked, stalled,
or unavailable media states. Reverse media playback uses timeline-driven
seeking because native negative media playback is not portable.

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
