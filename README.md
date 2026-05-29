# @moritzbrantner/timeline-editor

Generic timeline document utilities and React components for editing time-aligned items.

## Install

```sh
bun add @moritzbrantner/timeline-editor
```

The React components expect `react` and `react-dom` as peer dependencies and use
`@moritzbrantner/ui@^0.8.0` for workbench chrome. Timeline rendering is owned by
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
`./react`, `./commands`, `./history`, `./serialization`, `./media-types`,
`./text`, `./audio`, `./video`, `./image`, and `./data`.

Core document utilities, commands, history helpers, validation, serialization,
and media data helpers are pure functions. `TimelineEditor` and
`TimelineWorkbench` are controlled React components: hosts own document,
selection, viewport, clipboard, hotkey, and history state when they pass the
matching props.

`createTimelineAudioExtension()` from `./audio` includes a default browser audio
preview for audio items with a playable `data.source.uri`. Browser `File`
imports remain host-owned through `onImportAssets`; use
`createTimelineAudioFileAsset(file)` to turn an audio file into an asset and
keep ownership of the returned object URL cleanup callback.

`TimelineWorkbench` preview defaults to `previewMode="active-scene"`, which
shows items active at `document.currentTimeMs`. Use
`previewMode="selection-first"` to preserve selected-items-first previewing, or
`previewMode="mini-timeline"` for a compact read-only overview. The preview play
button is the synchronized workbench transport: it advances
`document.currentTimeMs`, moves the main timeline playhead, and keeps the
playhead visible with keep-visible scrolling. Native media controls rendered by
extensions remain independent browser controls.

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
- [Workbench integration](./docs/workbench.md)
- [Extensions and media foundations](./docs/extensions.md)
- [Serialization and migrations](./docs/serialization.md)
- [Release readiness](./docs/release-readiness.md)
- [Full reference archive](./docs/reference.md)
