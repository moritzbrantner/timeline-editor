# @moritzbrantner/timeline-editor

Generic timeline document utilities and React components for editing time-aligned items.

## Install

```sh
bun add @moritzbrantner/timeline-editor
```

The React components expect `react` as a peer dependency and use
`@moritzbrantner/ui@^0.8.0` for workbench chrome. Timeline rendering is owned by
this package.

## Main APIs

- `TimelineEditor` for a controlled, self-contained React timeline surface.
- `TimelineWorkbench` for a controlled workbench with assets, toolbar actions, inspector, markers, item context menus, and zoom.
- `normalizeTimelineEditorTracks(...)`, `moveTimelineEditorItem(...)`, `resizeTimelineEditorItem(...)`, `splitTimelineEditorItem(...)`, and `duplicateTimelineEditorItem(...)`.
- `insertTimelineEditorItem(...)`, `removeTimelineEditorItems(...)`, `moveTimelineEditorItems(...)`, `splitTimelineEditorItems(...)`, and `duplicateTimelineEditorItems(...)`.
- `setTimelineEditorItemTransform(...)`, `getTimelineEditorTransformValuesAt(...)`, and `getTimelineEditorItemTransformValuesAt(...)` for item-relative animated transform values.
- `applyTimelineEditorCommand(...)`, `createTimelineEditorHistory(...)`, `undoTimelineEditorHistory(...)`, and `redoTimelineEditorHistory(...)`.
- `validateTimelineEditorDocument(...)`, `serializeTimelineEditorDocument(...)`, `parseTimelineEditorDocument(...)`, and `migrateTimelineEditorDocument(...)`.
- `detectTimelineEditorOverlaps(...)`, `getTimelineEditorDurationMs(...)`, and timeline tick/snap helpers.

## Controlled React Example

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

Set `frameRate` to make pointer snapping, keyboard nudging, and timing inputs
use frame-sized increments.

## Development Example

Run the local Vite workbench to experiment with the package while developing:

```sh
bun dev
```

The example lives in `examples/dev` and imports the local `src` entrypoints through
Vite aliases.

## Core Command Example

```ts
import { applyTimelineEditorCommand } from "@moritzbrantner/timeline-editor/commands";

const result = applyTimelineEditorCommand(
  document,
  { itemIds: ["brief"] },
  { type: "move-items", itemIds: ["brief"], deltaMs: 500 },
);
```

## Transform Example

Timeline items can carry a generic transform made of item-relative points. Each
point stores numeric values, and helpers sample interpolated values at any time
inside the item.

```ts
import {
  getTimelineEditorItemTransformValuesAt,
  setTimelineEditorItemTransform,
} from "@moritzbrantner/timeline-editor";

const nextTracks = setTimelineEditorItemTransform(document.tracks, "brief", {
  points: [
    { offsetMs: 0, values: { x: 0, opacity: 1 } },
    { offsetMs: 2_000, values: { x: 100, opacity: 0 } },
  ],
});

const item = nextTracks[0].items[0];
const values = getTimelineEditorItemTransformValuesAt(item, 2_000);
// { x: 50, opacity: 0.5 } when the item starts at 1_000ms
```

## Serialization Example

```ts
import {
  parseTimelineEditorDocument,
  serializeTimelineEditorDocument,
} from "@moritzbrantner/timeline-editor/serialization";

const stored = serializeTimelineEditorDocument(document);
const restored = parseTimelineEditorDocument(stored);
```

## Media Kinds

Timeline items and workbench assets can declare a `kind`, and tracks can limit
placement with `acceptsItemKinds`. Workbench asset insertion respects those
limits, including when the currently selected track rejects the asset kind.

```tsx
<TimelineWorkbench
  document={{
    tracks: [
      { id: "video", label: "Video", acceptsItemKinds: ["video"], items: [] },
      { id: "audio", label: "Audio", acceptsItemKinds: ["audio"], items: [] },
    ],
  }}
  frameRate={24}
  assets={[{ id: "scene", label: "Scene", kind: "video", durationMs: 2_000 }]}
  getItemContextMenuItems={(context) =>
    context.mediaType === "video"
      ? [{ id: "transcode", label: "Transcode", onSelect: () => transcode(context.item) }]
      : []
  }
/>
```

## Notes

- The package also exposes `@moritzbrantner/timeline-editor/core`, `@moritzbrantner/timeline-editor/react`, `@moritzbrantner/timeline-editor/commands`, `@moritzbrantner/timeline-editor/history`, and `@moritzbrantner/timeline-editor/serialization` subpaths.
- Use this package for generic timeline workflows. Media-specific editing stays in `@moritzbrantner/media-editor`.
- The previous `@moritzbrantner/ui/labs` timeline adapter helpers were removed for v1. Use the package-native document shape directly.

## Enhancement Roadmap

- More complete multi-select inspector editing.
- Cross-track drag/drop placement.
- Richer visual snap feedback and viewport scroll helpers.
- Deeper examples for project planning, subtitles, sequencing, and annotation timelines.
