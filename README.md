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
- `TimelineWorkbench` for a controlled workbench with assets, toolbar actions, inspector, markers, item context menus, and zoom.
- `normalizeTimelineEditorTracks(...)`, `moveTimelineEditorItem(...)`, `resizeTimelineEditorItem(...)`, `splitTimelineEditorItem(...)`, and `duplicateTimelineEditorItem(...)`.
- `insertTimelineEditorItem(...)`, `removeTimelineEditorItems(...)`, `moveTimelineEditorItems(...)`, `splitTimelineEditorItems(...)`, and `duplicateTimelineEditorItems(...)`.
- `setTimelineEditorItemTransform(...)`, `getTimelineEditorTransformValuesAt(...)`, and `getTimelineEditorItemTransformValuesAt(...)` for item-relative animated transform values.
- `applyTimelineEditorCommand(...)`, `createTimelineEditorHistory(...)`, `undoTimelineEditorHistory(...)`, and `redoTimelineEditorHistory(...)`.
- `validateTimelineEditorDocument(...)`, `serializeTimelineEditorDocument(...)`, `parseTimelineEditorDocument(...)`, and `migrateTimelineEditorDocument(...)`.
- `detectTimelineEditorOverlaps(...)`, `getTimelineEditorDurationMs(...)`, and timeline tick/snap helpers.

## Core Editor

The core package stays media-agnostic. Items can represent any timed domain
object through `kind` and `data`, while the shared editor owns generic timeline
behavior: selection, ranges, move/resize/split/trim, grouping, markers, snapping,
overlap policies, validation, serialization, and history.

Clipboard commands are available through `TimelineEditorCommand`:

```ts
const copied = applyTimelineEditorCommand(document, selection, { type: "copy-selection" });
const pasted = applyTimelineEditorCommand(
  document,
  { itemIds: [] },
  {
    type: "paste-items",
    clipboard: copied.clipboard!,
    timeMs: document.currentTimeMs ?? 0,
  },
);
```

## Workbench

`TimelineWorkbench` layers ergonomic UI over the core reducer. It includes
undo/redo, copy/cut/paste, split, duplicate, group/ungroup, marker creation,
track context actions, tool selection, configurable hotkeys, an inspector, and
snap-aware asset insertion.

```tsx
<TimelineWorkbench
  document={document}
  selection={selection}
  clipboard={clipboard}
  onClipboardChange={setClipboard}
  hotkeys={{ copy: "Mod+C", paste: "Mod+V" }}
  onDocumentChange={setDocument}
  onSelectionChange={setSelection}
/>
```

## Extensions

Media-specific behavior belongs in extensions rather than the generic core.
An extension can contribute item rendering, preview rendering, inspector
sections, toolbar actions, context menu items, and pure operations.

```tsx
import { createTimelineAudioExtension } from "@moritzbrantner/timeline-editor/audio";
import { createTimelineTextExtension } from "@moritzbrantner/timeline-editor/text";
import { createTimelineVideoExtension } from "@moritzbrantner/timeline-editor/video";

<TimelineWorkbench
  document={document}
  extensions={[
    createTimelineAudioExtension(),
    createTimelineVideoExtension(),
    createTimelineTextExtension(),
  ]}
/>;
```

Built-in display-only media foundations are available from media-specific
subpaths:

- `@moritzbrantner/timeline-editor/text` for ASS-like timed text cues.
- `@moritzbrantner/timeline-editor/audio` for source metadata, volume/mute state, and waveform display.
- `@moritzbrantner/timeline-editor/video` for source metadata, poster, and thumbnail strips.
- `@moritzbrantner/timeline-editor/image` for still image thumbnails and dimensions.
- `@moritzbrantner/timeline-editor/data` for numeric data series and compact sparkline display.

These interfaces describe item data for display. They do not decode media,
generate waveforms or thumbnails, play audio/video, export renders, apply
effects, or implement transitions.

```tsx
import { TimelineWorkbench, type TimelineEditorDocument } from "@moritzbrantner/timeline-editor";
import {
  createTimelineAudioExtension,
  type TimelineAudioItemData,
} from "@moritzbrantner/timeline-editor/audio";
import {
  createTimelineNumericDataExtension,
  type TimelineNumericDataItemData,
} from "@moritzbrantner/timeline-editor/data";
import {
  createTimelineImageExtension,
  type TimelineImageItemData,
} from "@moritzbrantner/timeline-editor/image";
import {
  createTimelineTextExtension,
  type TimelineTextItemData,
} from "@moritzbrantner/timeline-editor/text";
import {
  createTimelineVideoExtension,
  type TimelineVideoItemData,
} from "@moritzbrantner/timeline-editor/video";

type MediaItemData =
  | TimelineTextItemData
  | TimelineAudioItemData
  | TimelineVideoItemData
  | TimelineImageItemData
  | TimelineNumericDataItemData;

const document: TimelineEditorDocument<Record<string, unknown>, MediaItemData> = {
  durationMs: 8_000,
  currentTimeMs: 1_500,
  tracks: [
    {
      id: "subtitles",
      label: "Subtitles",
      acceptsItemKinds: ["text", "caption", "subtitle"],
      items: [
        {
          id: "line-1",
          trackId: "subtitles",
          label: "Line 1",
          kind: "subtitle",
          startMs: 1_000,
          durationMs: 3_000,
          data: {
            mediaType: "text",
            format: "ass-like",
            cues: [{ startMs: 0, endMs: 1_500, text: "Hello timeline" }],
          },
        },
      ],
    },
    {
      id: "audio",
      label: "Audio",
      acceptsItemKinds: ["audio"],
      items: [
        {
          id: "voice",
          trackId: "audio",
          label: "Voiceover",
          kind: "audio",
          startMs: 0,
          durationMs: 4_000,
          data: {
            mediaType: "audio",
            source: { label: "voice.wav" },
            waveform: [0.1, 0.4, 0.8, 0.5],
          },
        },
      ],
    },
    {
      id: "video",
      label: "Video",
      acceptsItemKinds: ["video", "image", "numeric-data"],
      items: [
        {
          id: "scene",
          trackId: "video",
          label: "Scene",
          kind: "video",
          startMs: 0,
          durationMs: 4_000,
          data: {
            mediaType: "video",
            source: { label: "scene.mp4" },
            thumbnails: ["/thumb-1.jpg", "/thumb-2.jpg"],
          },
        },
        {
          id: "poster",
          trackId: "video",
          label: "Poster",
          kind: "image",
          startMs: 4_000,
          durationMs: 2_000,
          data: {
            mediaType: "image",
            thumbnail: "/poster.jpg",
            width: 1920,
            height: 1080,
          },
        },
        {
          id: "speed",
          trackId: "video",
          label: "Speed",
          kind: "numeric-data",
          startMs: 0,
          durationMs: 4_000,
          data: {
            mediaType: "numeric-data",
            series: [
              {
                label: "Speed",
                unit: "km/h",
                points: [
                  { timeMs: 0, value: 0 },
                  { timeMs: 1_000, value: 32 },
                  { timeMs: 2_000, value: 18 },
                ],
              },
            ],
          },
        },
      ],
    },
  ],
};

<TimelineWorkbench
  document={document}
  extensions={[
    createTimelineTextExtension(),
    createTimelineAudioExtension(),
    createTimelineVideoExtension(),
    createTimelineImageExtension(),
    createTimelineNumericDataExtension(),
  ]}
/>;
```

The private packages under `packages/audio`, `packages/video`, and
`packages/captions` re-export these public media entrypoints for compatibility.

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

## Core-only Usage

Non-React consumers should import the pure document utilities from the core
subpath:

```ts
import {
  moveTimelineEditorItem,
  normalizeTimelineEditorDocument,
} from "@moritzbrantner/timeline-editor/core";

const nextTracks = moveTimelineEditorItem(document.tracks, {
  itemId: "brief",
  startMs: 1_500,
});

const nextDocument = normalizeTimelineEditorDocument({ ...document, tracks: nextTracks });
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

## Edit Policies

Operations allow overlaps by default. Set `editPolicy.overlap` to reject or
resolve overlaps:

```ts
const prevented = moveTimelineEditorItem(
  document.tracks,
  { itemId: "brief", startMs: 1_500 },
  { editPolicy: { overlap: "prevent", ripple: false } },
);

const pushed = moveTimelineEditorItem(
  document.tracks,
  { itemId: "brief", startMs: 1_500 },
  { editPolicy: { overlap: "push", ripple: false } },
);
```

`"prevent"` returns the previous tracks when the edit would overlap. `"push"`
keeps the edit and shifts later unlocked items right; if a locked item or the
document duration blocks the push, the previous tracks are returned. Set
`editPolicy.ripple` on command options to shift later items left during
delete-selection commands. `TimelineEditor` and `TimelineWorkbench` also accept
an `editPolicy` prop so pointer, keyboard, toolbar, and asset-insert edits use
the same policy.

## Controlled Workbench Example

```tsx
import { useState } from "react";
import {
  TimelineWorkbench,
  type TimelineEditorDocument,
  type TimelineEditorSelection,
  type TimelineEditorViewport,
} from "@moritzbrantner/timeline-editor";

export function WorkbenchExample({ initialDocument }: { initialDocument: TimelineEditorDocument }) {
  const [document, setDocument] = useState(initialDocument);
  const [selection, setSelection] = useState<TimelineEditorSelection>({ itemIds: [] });
  const [viewport, setViewport] = useState<TimelineEditorViewport>({ pixelsPerSecond: 80 });

  return (
    <TimelineWorkbench
      document={document}
      selection={selection}
      viewport={viewport}
      assets={[{ id: "scene", label: "Scene", kind: "video", durationMs: 2_000 }]}
      onDocumentChange={setDocument}
      onSelectionChange={setSelection}
      onViewportChange={setViewport}
    />
  );
}
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
    { offsetMs: 0, values: { x: 0, opacity: 1 }, easing: "cubic" },
    { offsetMs: 2_000, values: { x: 100, opacity: 0 } },
  ],
});

const item = nextTracks[0].items[0];
const values = getTimelineEditorItemTransformValuesAt(item, 2_000);
// { x: 50, opacity: 0.5 } when the item starts at 1_000ms
```

Set `easing` on the point that starts a segment to control how values change
until the next point. Supported easings are `linear`, `hold`, `ease-in`,
`ease-out`, `ease-in-out`, `quadratic`, `quadratic-in`, `quadratic-out`,
`quadratic-in-out`, `cubic`, `cubic-in`, `cubic-out`, `cubic-in-out`, `quartic`,
`quartic-in`, `quartic-out`, and `quartic-in-out`.

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
