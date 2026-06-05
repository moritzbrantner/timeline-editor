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
- `TimelineWorkbench` for a controlled workbench with assets, toolbar actions, inspector, markers, item context menus, and zoom.
- `normalizeTimelineEditorTracks(...)`, `moveTimelineEditorItem(...)`, `resizeTimelineEditorItem(...)`, `splitTimelineEditorItem(...)`, and `duplicateTimelineEditorItem(...)`.
- `insertTimelineEditorItem(...)`, `removeTimelineEditorItems(...)`, `moveTimelineEditorItems(...)`, `splitTimelineEditorItems(...)`, and `duplicateTimelineEditorItems(...)`.
- `setTimelineEditorItemTransform(...)`, `upsertTimelineEditorTransformPoint(...)`, `updateTimelineEditorTransformPoint(...)`, `moveTimelineEditorTransformPoint(...)`, `removeTimelineEditorTransformPoint(...)`, `getTimelineEditorTransformValuesAt(...)`, and `getTimelineEditorItemTransformValuesAt(...)` for item-relative animated transform values.
- `addTimelineEditorTracksToGroup(...)`, `removeTimelineEditorTracksFromGroup(...)`, and `moveTimelineEditorTrackInGroup(...)` for track-group workflows.
- `applyTimelineEditorCommand(...)`, `createTimelineEditorHistory(...)`, `undoTimelineEditorHistory(...)`, and `redoTimelineEditorHistory(...)`.
- `validateTimelineEditorDocument(...)`, `serializeTimelineEditorDocument(...)`, `parseTimelineEditorDocument(...)`, and `migrateTimelineEditorDocument(...)`.
- `detectTimelineEditorOverlaps(...)`, `getTimelineEditorDurationMs(...)`, and timeline tick/snap helpers.

## API Policy

The public `1.x` package surface is the root export plus these subpaths: `./core`,
`./react`, `./commands`, `./history`, `./serialization`, `./extensions`,
`./media-types`, `./text`, `./audio`, `./video`, `./image`, and `./data`.

Core document utilities, commands, history helpers, validation, serialization,
and media data helpers are pure functions. `TimelineEditor` and
`TimelineWorkbench` are controlled React components: hosts own document,
selection, viewport, hotkey, and clipboard state when they pass the matching
props.

## Core Editor

The core package stays media-agnostic. Items can represent any timed domain
object through `kind` and `data`, while the shared editor owns generic timeline
behavior: selection, ranges, move/resize/split/trim, grouping, markers, snapping,
overlap policies, validation, serialization, and history. `item.kind` is the
canonical field for track compatibility and exact extension matching.
`data.mediaType`, when present, identifies one of the built-in media data
families: `audio`, `video`, `image`, `text`, or `numeric-data`.

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

The toolbar includes a Hotkeys menu for rebinding workbench shortcuts at runtime.
Use `onHotkeysChange` when the host app should persist the user overrides.
Pass `inspectorSchema.transformFields` to enable default keyframe editing for
numeric item transform values. The default inspector also exposes concrete
document, track, range, marker, item, and multi-item states. Track-only
selection is represented by `selection.trackIds`, and `onSelectedItemChange`
receives the selected track even when no item is selected.

File and URL import are host-owned. `onImportAssets` receives browser `File`
sources for file import and URL sources when `allowUrlImport` is enabled. URL
sources use `type: "url"` and include a normalized absolute `url`; the host
returns imported `TimelineWorkbenchAsset` records just like file imports.
Import results may also return per-source `warnings`, `errors`, and `metadata`;
the default assets panel shows all warned or failed sources with retry and clear
recovery controls.

The workbench preview defaults to `previewMode="active-scene"`. The other public
modes are `selection-first` and `mini-timeline`; use `onPreviewModeChange` to
persist user mode changes. The workbench transport advances
`document.currentTimeMs`, so `onDocumentChange` receives playhead-only updates
and the main timeline follows with keep-visible scrolling while transport
playback is active. Space toggles play/pause, K pauses, L shuttles forward
through 1x/2x/4x, J shuttles backward through -1x/-2x/-4x, and Shift+L toggles
loop playback. Loop uses the selected range when present and otherwise loops the
whole document, wrapping at exact range or document boundaries. Transport
defaults to paused, `1x`, and loop off; pass
`transportState`, `defaultTransportState`, and `onTransportStateChange` to
control or observe it. Workbench audio preview is synchronized through hidden
media elements instead of native audio controls: audio starts with the workbench
transport and pauses when it pauses, stops, or ends. Video controls remain
independent manual controls while the workbench transport is the synchronized
path. Reverse playback synchronizes media by seeking rather than relying on
native negative playback rates. Extension
`renderPreview` fallback composes custom preview output with common compositor
layers in mixed scenes, while all-custom previews may still own the whole body.

```tsx
<TimelineWorkbench
  document={document}
  selection={selection}
  clipboard={clipboard}
  onClipboardChange={setClipboard}
  hotkeys={hotkeys}
  onHotkeysChange={setHotkeys}
  previewMode={previewMode}
  onPreviewModeChange={setPreviewMode}
  transportState={transportState}
  defaultTransportState={{ loop: true }}
  onTransportStateChange={setTransportState}
  onDocumentChange={setDocument}
  onSelectionChange={setSelection}
/>
```

## Choosing APIs

- Use core operations from `@moritzbrantner/timeline-editor/core` for non-React
  state management.
- Use commands when edits should share selection, clipboard, and undo/redo
  semantics.
- Use `TimelineWorkbench` when you want a controlled editing surface with
  toolbar, assets, preview, inspector, groups, and context menus.
- Use extensions for media-specific item rendering, preview rendering,
  inspector sections, toolbar actions, context menu items, and operations.

## Extensions

Media-specific behavior belongs in extensions rather than the generic core.
An extension can contribute item rendering, preview rendering, inspector
sections, toolbar actions, context menu items, and pure operations.
`TimelineWorkbench` resolves item renderers by exact `extension.itemKinds` first,
then by normalized `extension.mediaTypes`, then by the consumer
`renderTimelineItem` fallback.

```tsx
import {
  createTimelineAudioExtension,
  createTimelineAudioFileAsset,
} from "@moritzbrantner/timeline-editor/audio";
import { createTimelineTextExtension } from "@moritzbrantner/timeline-editor/text";
import {
  createTimelineVideoExtension,
  createTimelineVideoFileAsset,
} from "@moritzbrantner/timeline-editor/video";

<TimelineWorkbench
  document={document}
  extensions={[
    createTimelineAudioExtension(),
    createTimelineVideoExtension(),
    createTimelineTextExtension(),
  ]}
/>;
```

Built-in media foundations are available from media-specific subpaths:

- `@moritzbrantner/timeline-editor/media-types` for media type normalization and media-specific validation helpers.
- `@moritzbrantner/timeline-editor/text` for subtitle/caption cues, practical
  ASS/SSA, SRT, and WebVTT parsing, and text `File` to asset conversion.
- `@moritzbrantner/timeline-editor/audio` for source metadata, volume/mute state, waveform display, synchronized workbench audio preview, and audio `File` to asset conversion.
- `@moritzbrantner/timeline-editor/video` for source metadata, poster, thumbnail strips, and video `File` to asset conversion.
- `@moritzbrantner/timeline-editor/image` for still image thumbnails and dimensions.
- `@moritzbrantner/timeline-editor/data` for numeric data series and compact sparkline display.

## Limitations

`createTimelineAudioExtension()` renders audio item metadata and supports
synchronized hidden workbench preview playback for audio items with
`data.source.uri`. Use
`createTimelineAudioFileAsset(file)` inside a host `onImportAssets` callback to
create audio assets from browser files with source metadata, optional Web Audio
duration/channel/sample-rate probing, and best-effort waveform peaks. Pass
`generateWaveform: false` to skip browser decoding, or pass `waveform` to use
host-supplied peaks; returning the helper result lets `TimelineWorkbench`
revoke workbench-owned object URLs on unmount. Use
`createTimelineVideoFileAsset(file)` for matching video file imports with
duration probing, dimensions, poster generation, optional thumbnails, MIME
metadata, and object URL cleanup. Use `createTimelineMediaSourceRegistry()`
for host-owned source lifetimes outside the workbench import flow.

The audio file helper can generate lightweight browser-only waveform peaks with
Web Audio and falls back when decoding is unavailable. Built-in media extensions
do not export renders, apply effects, or implement transitions. Workbench audio
preview is timeline-driven rather than a native audio player, while video
controls remain available for manual preview. Workbench transport playback
synchronizes active media elements to the timeline playhead.

Subtitle preview supports common ASS/SSA, SRT, and WebVTT timing and styling in
the workbench scene preview. The ASS renderer is intentionally a practical
subset: cue text, styles, alignment, margins, colors, simple override tags, and
line breaks are supported, while karaoke, vector drawings, animated transforms,
clips, and full libass fidelity are out of scope for the built-in preview.

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
  createTimelineTextFileAsset,
  type TimelineTextItemData,
} from "@moritzbrantner/timeline-editor/text";
import {
  createTimelineVideoExtension,
  type TimelineVideoItemData,
} from "@moritzbrantner/timeline-editor/video";
import {
  getTimelineMediaTypeForItem,
  validateTimelineEditorMediaTypes,
} from "@moritzbrantner/timeline-editor/media-types";

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

const subtitleAsset = await createTimelineTextFileAsset(
  new File(["00:00:00,000 --> 00:00:02,000\nHello timeline"], "captions.srt", {
    type: "application/x-subrip",
  }),
);

const mediaType = getTimelineMediaTypeForItem(document.tracks[0]!.items[0]!);
const mediaIssues = validateTimelineEditorMediaTypes(document);
```

## Package Layout

The main `@moritzbrantner/timeline-editor` package owns the generic editor and
lightweight root exports. Optional split packages under `@timeline-editor/*`
provide accelerated domain entrypoints:

- `@timeline-editor/compute` for the shared browser worker, Tauri, adaptive,
  and fallback compute backend contract.
- `@timeline-editor/audio`, `@timeline-editor/video`,
  `@timeline-editor/image`, `@timeline-editor/captions`,
  `@timeline-editor/geo`, and `@timeline-editor/data` for domain helpers that
  accept an optional backend and fall back to lightweight behavior.
- `@timeline-editor/tauri` for the Tauri invoke backend adapter.

The root package does not import these split packages.

## Recipes

- Controlled `TimelineEditor`: pass `document`, `selection`, `onDocumentChange`,
  and `onSelectionChange`.
- Controlled `TimelineWorkbench`: pass document and selection state, then opt in
  to assets, inspector schema, clipboard, viewport, and hotkey persistence as
  needed.
- Custom item rendering: pass `renderTimelineItem` to `TimelineWorkbench` or
  `renderItem` to `TimelineEditor`.
- Custom asset insertion: pass `assets`, `onAssetInsert`, and optional
  `renderAsset`.
- Host-owned imports: pass `onImportAssets`; add `allowUrlImport` when URL
  import controls should be visible.
- Serialization and migration: save `serializeTimelineEditorDocument(document)`;
  load with `migrateTimelineEditorDocument(stored).document`.
- Hotkey persistence: pass `hotkeys` and persist changes from
  `onHotkeysChange`.
- Preview mode persistence: pass `previewMode` and persist changes from
  `onPreviewModeChange`. Omit both to use the internal `active-scene` default.
- Read-only mode: pass `readOnly` to block pointer, keyboard, toolbar, and
  context-menu mutations.

Longer examples are mirrored in `tests/examples/*.tsx` so
`bun run check-examples` keeps the documented API usage typechecked.

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

## Composable Timeline Editor

`TimelineEditor` is the default controlled editor. The lower-level pieces are
public for hosts that need custom chrome or replacement track and clip
rendering.

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

You can also render only `TimelineEditorTracks` or only `TimelineEditorRuler`
inside the provider/root/content shell when a host owns the surrounding layout.

## Development Example

Run the local Vite workbench to experiment with the package while developing:

```sh
bun dev
```

The example lives in `examples/dev` and imports the local `src` entrypoints through
Vite aliases.

## Contributor Checks

- Use `bun run verify:quick` for normal changes before opening a PR.
- Use `bun run verify` before release-oriented changes.
- Use `bun run test:playwright` when touching workbench UI behavior.

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
      inspectorSchema={{
        transformFields: [
          { id: "x", label: "X", step: 1, defaultValue: 0 },
          { id: "opacity", label: "Opacity", min: 0, max: 1, step: 0.1, defaultValue: 1 },
        ],
      }}
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
  moveTimelineEditorTransformPoint,
  setTimelineEditorItemTransform,
  upsertTimelineEditorTransformPoint,
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

const withKeyframe = upsertTimelineEditorTransformPoint(document.tracks, "brief", {
  offsetMs: 1_000,
  values: { x: 50, opacity: 0.75 },
  easing: "ease-out",
});

const movedKeyframe = moveTimelineEditorTransformPoint(withKeyframe, "brief", 1_000, 1_500);
```

Set `easing` on the point that starts a segment to control how values change
until the next point. Supported easings are `linear`, `hold`, `ease-in`,
`ease-out`, `ease-in-out`, `quadratic`, `quadratic-in`, `quadratic-out`,
`quadratic-in-out`, `cubic`, `cubic-in`, `cubic-out`, `cubic-in-out`, `quartic`,
`quartic-in`, `quartic-out`, and `quartic-in-out`.

## Serialization Example

```ts
import { migrateTimelineEditorDocument } from "@moritzbrantner/timeline-editor";
import {
  currentTimelineEditorSchemaVersion,
  parseTimelineEditorDocument,
  serializeTimelineEditorDocument,
} from "@moritzbrantner/timeline-editor/serialization";

const stored = serializeTimelineEditorDocument(document);
const restored = parseTimelineEditorDocument(stored);
const migrated = migrateTimelineEditorDocument(stored).document;
const schemaVersion = currentTimelineEditorSchemaVersion;
```

Serialized documents use `schemaVersion: 1`, also exported as
`currentTimelineEditorSchemaVersion`. Save with
`serializeTimelineEditorDocument(document)` and load with
`migrateTimelineEditorDocument(stored).document`. `migrateTimelineEditorDocument`
accepts raw documents and v1 serialized documents, preserves custom `data`, and
throws `TimelineEditorMigrationError` for unsupported future schema versions.
Custom `data` fields should be JSON-compatible host data.

## Media Kinds

Timeline items, workbench assets, and tracks can declare a `kind`. A typed track
only accepts items and assets with the same kind. Untyped tracks can still limit
placement with `acceptsItemKinds`. Workbench asset insertion respects those
limits, including when the currently selected track rejects the asset kind.
Workbench assets can also expose `mediaType` as normalized descriptive metadata;
placement still uses `kind`.

Context menus receive both `itemKind` and normalized `mediaType`. Use
`itemKind` when exact aliases matter, such as `subtitle`; use `mediaType` when
handling a built-in family such as all text-like items.

```tsx
<TimelineWorkbench
  document={{
    tracks: [
      { id: "video", label: "Video", kind: "video", items: [] },
      { id: "audio", label: "Audio", kind: "audio", items: [] },
    ],
  }}
  frameRate={24}
  assets={[
    {
      id: "scene",
      label: "Scene",
      kind: "video",
      mediaType: "video",
      durationMs: 2_000,
      data: {
        mediaType: "video",
        source: { label: "scene.mp4", mimeType: "video/mp4" },
      },
    },
  ]}
  getItemContextMenuItems={(context) => {
    if (context.mediaType === "video") {
      return [{ id: "transcode", label: "Transcode", onSelect: () => transcode(context.item) }];
    }

    if (context.itemKind === "subtitle") {
      return [{ id: "edit-subtitle", label: "Edit Subtitle", onSelect: () => edit(context.item) }];
    }

    return [];
  }}
/>
```

## Track Groups

Track groups organize related tracks without changing the underlying track
shape. Groups can be collapsed, locked, renamed, removed, and edited from the
workbench track-group row, track-group right-click menu, and track context
menus. Dissolving a group preserves the tracks and items it referenced.

```tsx
import {
  TimelineWorkbench,
  addTimelineEditorTracksToGroup,
  moveTimelineEditorTrackInGroup,
  removeTimelineEditorTracksFromGroup,
} from "@moritzbrantner/timeline-editor";

const groupedDocument = {
  durationMs: 10_000,
  groups: [{ id: "program", label: "Program", trackIds: ["video", "audio", "captions"] }],
  tracks: [
    { id: "video", label: "Video", kind: "video", items: [] },
    { id: "audio", label: "Audio", kind: "audio", items: [] },
    { id: "captions", label: "Captions", acceptsItemKinds: ["caption"], items: [] },
  ],
};

const withNotes = addTimelineEditorTracksToGroup(groupedDocument, "program", ["notes"]);
const reordered = moveTimelineEditorTrackInGroup(withNotes, "program", "audio", 0);
const withoutCaptions = removeTimelineEditorTracksFromGroup(reordered, "program", ["captions"]);

<TimelineWorkbench document={withoutCaptions} />;
```

## Timeline Context Menus

`TimelineEditor` and `TimelineWorkbench` can expose right-click menus for empty
timeline lanes and the ruler. The context includes the clicked time, snapped
time, source, selected items, and track when the click happened inside a track
lane. Consumers own application-specific state such as frame rate.

```tsx
const [frameRate, setFrameRate] = useState(30);

<TimelineWorkbench
  document={document}
  frameRate={frameRate}
  onDocumentChange={setDocument}
  getTimelineContextMenuItems={(context) => [
    {
      id: "frame-rate",
      type: "radio-group",
      label: "Frame rate",
      value: String(frameRate),
      options: [24, 25, 30, 50, 60].map((fps) => ({
        id: `fps-${fps}`,
        value: String(fps),
        label: `${fps} fps`,
      })),
      onValueChange: (value) => setFrameRate(Number(value)),
    },
    {
      id: "add-marker-at-click",
      label: "Add marker here",
      disabled: context.readOnly,
      onSelect: () => context.addMarker(context.snappedTimeMs),
    },
  ]}
/>;
```

## Notes

- The package also exposes `@moritzbrantner/timeline-editor/core`, `@moritzbrantner/timeline-editor/react`, `@moritzbrantner/timeline-editor/commands`, `@moritzbrantner/timeline-editor/history`, and `@moritzbrantner/timeline-editor/serialization` subpaths.
- Use this package for generic timeline workflows. Media-specific editing stays in `@moritzbrantner/media-editor`.
- The previous `@moritzbrantner/ui/labs` timeline adapter helpers were removed for v1. Use the package-native document shape directly.

## Enhancement Roadmap

- More complete transform/keyframe inspector editing.
- Broader track-group workflows for multi-track project structures.
- Deeper examples for subtitles, sequencing, and annotation timelines.
