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
- `TimelineWorkbench` for a controlled workbench with assets, toolbar actions, inspector, markers, and zoom.
- `normalizeTimelineEditorTracks(...)`, `moveTimelineEditorItem(...)`, `resizeTimelineEditorItem(...)`, `splitTimelineEditorItem(...)`, and `duplicateTimelineEditorItem(...)`.
- `insertTimelineEditorItem(...)`, `removeTimelineEditorItems(...)`, `moveTimelineEditorItems(...)`, `splitTimelineEditorItems(...)`, and `duplicateTimelineEditorItems(...)`.
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
      onDocumentChange={setDocument}
      onSelectionChange={setSelection}
    />
  );
}
```

## Core Command Example

```ts
import { applyTimelineEditorCommand } from "@moritzbrantner/timeline-editor/commands";

const result = applyTimelineEditorCommand(
  document,
  { itemIds: ["brief"] },
  { type: "move-items", itemIds: ["brief"], deltaMs: 500 },
);
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

## Notes

- The package also exposes `@moritzbrantner/timeline-editor/core`, `@moritzbrantner/timeline-editor/react`, `@moritzbrantner/timeline-editor/commands`, `@moritzbrantner/timeline-editor/history`, and `@moritzbrantner/timeline-editor/serialization` subpaths.
- Use this package for generic timeline workflows. Media-specific editing stays in `@moritzbrantner/media-editor`.
- The previous `@moritzbrantner/ui/labs` timeline adapter helpers were removed for v1. Use the package-native document shape directly.

## Enhancement Roadmap

- More complete multi-select inspector editing.
- Cross-track drag/drop placement.
- Richer visual snap feedback and viewport scroll helpers.
- Deeper examples for project planning, subtitles, sequencing, and annotation timelines.
