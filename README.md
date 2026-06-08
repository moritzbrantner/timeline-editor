# @moritzbrantner/timeline-editor

Generic timeline document utilities and React components for editing time-aligned items.

## Install

```sh
bun add @moritzbrantner/timeline-editor
```

The React components expect `react` and `react-dom` as peer dependencies and use
`@moritzbrantner/ui@^0.10.0` for workbench chrome. Timeline rendering is owned by
this package.

## Main APIs

- `TimelineEditor` for a controlled, self-contained React timeline surface.
- `TimelineWorkbench` for a controlled workbench with assets, toolbar actions,
  inspector, markers, item context menus, preview, hotkeys, and zoom.
- Core operations such as `normalizeTimelineEditorTracks(...)`,
  `moveTimelineEditorItem(...)`, `resizeTimelineEditorItem(...)`,
  `splitTimelineEditorItem(...)`, and `duplicateTimelineEditorItem(...)`.
- Command/history helpers such as `applyTimelineEditorCommand(...)`,
  `createTimelineEditorHistory(...)`, `undoTimelineEditorHistory(...)`, and
  `redoTimelineEditorHistory(...)`.
- Persistence helpers such as `serializeTimelineEditorDocument(...)`,
  `parseTimelineEditorDocument(...)`, and `migrateTimelineEditorDocument(...)`.

## API Policy

The public package surface is the root export plus these subpaths: `./core`,
`./react`, `./commands`, `./history`, `./serialization`, `./extensions`,
`./media-types`, `./media-import`, `./text`, `./audio`, `./video`, `./image`,
and `./data`.

Core document utilities, commands, history helpers, validation, serialization,
and serializable media data helpers are pure functions. Browser media source
lifecycle helpers expose explicit cleanup callbacks. `TimelineEditor` and
`TimelineWorkbench` are controlled React components: hosts own document,
selection, viewport, clipboard, hotkey, and history state when they pass the
matching props.

`createTimelineAudioExtension()` from `./audio` includes audio source metadata,
centered waveform item rendering, compact clip mute/volume badges, selected-item
mute and volume inspector controls, and a selected-item audio metadata
inspector. Audio waveforms honor `sourceStartMs`/`sourceEndMs`, downsample to the
visible clip width, and hide metadata before waveform/state on narrow clips.
Browser `File` and URL imports remain host-owned through
`onImportAssets`; use `createTimelineAudioFileAsset(file)` to turn an audio file
into an asset. It best-effort extracts duration, channels, sample rate, and a
compact waveform with browser Web Audio APIs, can be disabled with
`generateWaveform: false`, and gracefully falls back when decoding is
unavailable. Use
`createTimelineVideoFileAsset(file)` from `./video` to probe video duration,
dimensions, poster, optional thumbnails, and source metadata. The video
extension renders adaptive filmstrip clips from thumbnails or a full poster
fallback and marks trimmed `sourceStartMs`/`sourceEndMs` source ranges. Use
`createTimelineImageFileAsset(file)` from `./image` for image object URL assets.
For common host-owned imports, create one source library and pass the unified
resolver to the workbench:

```tsx
const sourceLibrary = createTimelineMediaSourceLibrary();

<TimelineWorkbench onImportAssets={createTimelineMediaImportResolver({ sourceLibrary })} />;
```

`createTimelineMediaImportResolver` can also be imported from
`@moritzbrantner/timeline-editor/media-import` when hosts want the dedicated
media-import subpath. See [Media Import Adoption](./docs/media-import-adoption.md)
for root-package and split-package recipes.

Call `sourceLibrary.dispose()` when the editing session is destroyed. The
returned cleanup callbacks are also accepted by `TimelineWorkbenchImportResult`,
so workbench-owned imports are revoked on unmount. Use
`createTimelineMediaSourceRegistry()` from `./media-types` for older host code
that owns sources outside the workbench import flow. Set `allowUrlImport` with
`onImportAssets` to expose URL import controls that emit
`TimelineWorkbenchImportSource` entries with `type: "url"`.

Track selection is represented with `selection.trackIds`. The default
workbench inspector has document, track, range, marker, item, and multi-item
states, and the track state exposes concrete track metadata plus track actions.

Workbench import state reports progress, warnings, cancellation, and per-source
failures when the host uses the optional import context passed to
`onImportAssets`. Existing one-argument import callbacks continue to work, and
returned `warnings` are surfaced in the assets panel. Per-source diagnostics
preserve source/result metadata and the default panel shows all failed or warned
sources with retry and clear recovery controls.

`TimelineWorkbench` preview defaults to `previewMode="active-scene"`, which
shows items active at `document.currentTimeMs`. Use
`previewMode="selection-first"` to preserve selected-items-first previewing, or
`previewMode="mini-timeline"` for a compact read-only overview. The compact
transport strip supports Space, J/K/L shuttle playback, frame stepping, and loop
playback. Transport defaults to paused, `1x`, loop off; hosts can use
`transportState`, `defaultTransportState`, and `onTransportStateChange` for
controlled or observed playback. Loop playback uses a valid selected range and
falls back to the whole document, wrapping at exact selected-range or document
boundaries. It advances `document.currentTimeMs`, moves the main timeline
playhead, and keeps the playhead visible with keep-visible scrolling while
playing. Scene preview audio and video are controlled by the workbench
transport; native browser controls are intentionally omitted from the scene
preview. Detail and extension preview players may still expose browser controls
for inspection. Browser autoplay restrictions and source failures are surfaced
in preview as blocked, stalled, or unavailable media states, and reverse
synchronization uses timeline-driven seeking instead of native negative
playback.

## Controlled Timeline

```tsx
import { useState } from "react";
import {
  TimelineEditor,
  type TimelineEditorDocument,
  type TimelineEditorSelection,
} from "@moritzbrantner/timeline-editor";

const initialDocument: TimelineEditorDocument = {
  durationMs: 8_000,
  currentTimeMs: 1_000,
  markers: [{ id: "handoff", timeMs: 4_000, label: "Handoff" }],
  tracks: [
    {
      id: "planning",
      label: "Planning",
      items: [
        {
          id: "brief",
          trackId: "planning",
          label: "Brief",
          startMs: 1_000,
          durationMs: 2_000,
        },
      ],
    },
  ],
};

export function Example() {
  const [document, setDocument] = useState(initialDocument);
  const [selection, setSelection] = useState<TimelineEditorSelection>({ itemIds: [] });

  return (
    <TimelineEditor
      document={document}
      selection={selection}
      frameRate={24}
      onDocumentChange={setDocument}
      onSelectionChange={setSelection}
    />
  );
}
```

## Composable Timeline Editor

`TimelineEditor` is the stable simple entry point. Use the composable parts when
you need to replace the shell, ruler, tracks, rows, lanes, headers, or clips.

```tsx
import { useState } from "react";
import {
  TimelineEditorContent,
  TimelineEditorProvider,
  TimelineEditorRoot,
  TimelineEditorRuler,
  TimelineEditorTracks,
  type TimelineEditorComponents,
  type TimelineEditorDocument,
  type TimelineEditorSelection,
} from "@moritzbrantner/timeline-editor";

export function ModularTimeline({ initialDocument }: { initialDocument: TimelineEditorDocument }) {
  const [document, setDocument] = useState(initialDocument);
  const [selection, setSelection] = useState<TimelineEditorSelection>({ itemIds: [] });
  const components: TimelineEditorComponents = {
    TrackHeader({ entry }) {
      return <div data-slot="timeline-editor-track-header">{entry.track.label}</div>;
    },
    Clip({ item, onMovePointerDown }) {
      return (
        <div
          data-slot="timeline-editor-clip"
          role="button"
          tabIndex={0}
          onPointerDown={onMovePointerDown}
        >
          {item.label}
        </div>
      );
    },
  };

  return (
    <TimelineEditorProvider
      document={document}
      selection={selection}
      onDocumentChange={setDocument}
      onSelectionChange={setSelection}
    >
      <TimelineEditorRoot className="h-full">
        <TimelineEditorContent>
          <TimelineEditorRuler />
          <TimelineEditorTracks components={components} />
        </TimelineEditorContent>
      </TimelineEditorRoot>
    </TimelineEditorProvider>
  );
}
```

## Controlled Workbench

```tsx
import { useState } from "react";
import {
  TimelineWorkbench,
  createTimelineEditorHistory,
  type TimelineEditorClipboard,
  type TimelineEditorDocument,
  type TimelineEditorHistory,
  type TimelineEditorSelection,
  type TimelineEditorViewport,
} from "@moritzbrantner/timeline-editor";
import { createTimelineAudioExtension } from "@moritzbrantner/timeline-editor/audio";

export function WorkbenchExample({ initialDocument }: { initialDocument: TimelineEditorDocument }) {
  const [document, setDocument] = useState(initialDocument);
  const [selection, setSelection] = useState<TimelineEditorSelection>({ itemIds: [] });
  const [viewport, setViewport] = useState<TimelineEditorViewport>({ pixelsPerSecond: 80 });
  const [clipboard, setClipboard] = useState<TimelineEditorClipboard>();
  const [history, setHistory] = useState<TimelineEditorHistory>(() =>
    createTimelineEditorHistory(),
  );

  return (
    <TimelineWorkbench
      document={document}
      selection={selection}
      viewport={viewport}
      clipboard={clipboard}
      history={history}
      assets={[{ id: "scene", label: "Scene", kind: "video", durationMs: 2_000 }]}
      extensions={[createTimelineAudioExtension()]}
      onDocumentChange={setDocument}
      onSelectionChange={setSelection}
      onViewportChange={setViewport}
      onClipboardChange={setClipboard}
      onHistoryChange={setHistory}
    />
  );
}
```

## Development

```sh
bun dev
bun run verify:quick
bun run verify
bun run test:playwright
```

Use `bun run verify:quick` for normal changes before opening a PR. Use
`bun run verify` and `bun run test:playwright` before release-oriented changes.

## Deeper Docs

- [Core document model and operations](./docs/core.md)
- [Architecture and package layering](./docs/architecture.md)
- [Domain extension boundaries](./docs/domain-extensions.md)
- [Workbench integration](./docs/workbench.md)
- [Extensions and media foundations](./docs/extensions.md)
- [Serialization and migrations](./docs/serialization.md)
- [Release readiness](./docs/release-readiness.md)
- [Full reference archive](./docs/reference.md)
