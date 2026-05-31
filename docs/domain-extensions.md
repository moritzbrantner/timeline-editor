# Domain Extensions

`timeline-editor` stays generic by accepting domain data without interpreting
it. Domain packages own their specialized models, previews, inspectors, import
and export formats, and heavy processing.

## Decision Rule

If the feature applies to any timed item, it belongs in `timeline-editor`.

If the feature applies only to GeoJSON, map layers, camera paths, or map styles,
it belongs in `timeline-map`.

If the feature applies only to story beats, scenes, narration, story graphs, or
storytelling-library integration, it belongs in `timeline-story`.

If the feature applies only to subtitles, captions, or timed text formats, it
belongs in `timeline-subtitles`.

If the feature applies only to video/audio/image media editing, rendering,
proxies, effects, transitions, decoding, encoding, or export, it belongs in
`media-editor-*`.

If the feature requires Rust/WASM, workers, WebCodecs, FFmpeg, demuxing, muxing,
rendering, proxies, caching, or heavy processing, it does not belong in
`timeline-editor` core.

## Adapter Type Sketches

```ts
import type {
  TimelineEditorDocument,
  TimelineMediaSourceRef,
} from "@moritzbrantner/timeline-editor";

export type TimelineMapItemData = {
  domain: "map";
  mediaType?: "data";
  source?: {
    id?: string;
    uri?: string;
    label?: string;
  };
  geojson?: unknown;
  layerId?: string;
  layerType?: "geojson" | "marker" | "route" | "raster" | "vector";
  camera?: {
    center?: [number, number];
    zoom?: number;
    bearing?: number;
    pitch?: number;
  };
  style?: Record<string, unknown>;
  opacity?: number;
};

export type TimelineStoryItemData = {
  domain: "story";
  storyElementType:
    | "scene"
    | "beat"
    | "chapter"
    | "narration"
    | "dialogue"
    | "visual"
    | "sound"
    | "annotation";
  storyId?: string;
  characterIds?: string[];
  locationId?: string;
  text?: string;
  metadata?: Record<string, unknown>;
};

export type TimelineSubtitleItemData = {
  domain: "subtitle";
  mediaType: "text";
  format?: "srt" | "vtt" | "ass" | "ssa" | "unknown";
  text: string;
  speaker?: string;
  language?: string;
  style?: Record<string, unknown>;
  sourceCueId?: string;
};

export type MediaEditorProject = {
  id: string;
  timeline: TimelineEditorDocument<MediaTrackData, MediaClipData>;
  assets: MediaAsset[];
  renderSettings: RenderSettings;
};

export type MediaTrackData = {
  domain: "media";
  role?: "video" | "audio" | "image" | "text" | "data" | "mixed";
  metadata?: Record<string, unknown>;
};

export type MediaAsset = {
  id: string;
  kind: "video" | "audio" | "image" | "subtitle" | "data";
  source: TimelineMediaSourceRef;
  durationMs?: number;
  width?: number;
  height?: number;
  frameRate?: number;
  metadata?: Record<string, unknown>;
};

export type RenderSettings = {
  width?: number;
  height?: number;
  frameRate?: number;
  sampleRate?: number;
  format?: string;
};

export type MediaEffect = {
  id: string;
  type: string;
  enabled?: boolean;
  parameters?: Record<string, unknown>;
};

export type TransitionRef = {
  id: string;
  type: string;
  durationMs?: number;
  parameters?: Record<string, unknown>;
};

export type MediaClipData = {
  domain: "media";
  mediaType: "video" | "audio" | "image" | "text" | "numeric-data";
  assetId: string;
  sourceStartMs?: number;
  sourceEndMs?: number;
  speed?: number;
  volume?: number;
  muted?: boolean;
  opacity?: number;
  transform?: Record<string, unknown>;
  effects?: MediaEffect[];
  transitionIn?: TransitionRef;
  transitionOut?: TransitionRef;
};
```

## Extension Factory Sketches

```tsx
import type { TimelineEditorExtension } from "@moritzbrantner/timeline-editor";

export function createMapTimelineExtension(): TimelineEditorExtension<TimelineMapItemData> {
  return {
    id: "timeline-map",
    itemKinds: ["map", "map-layer", "map-camera"],
    domains: ["map"],
    renderItem: ({ item }) => <span>{item.label}</span>,
    renderPreview: ({ items }) => <div>{items.map((item) => item.label).join(", ")}</div>,
    inspectorSections: [({ selectedItem }) => (selectedItem ? <section>Map item</section> : null)],
    toolbarActions: [() => <button type="button">Map action</button>],
    contextMenuItems: () => [{ id: "map-action", label: "Map action" }],
    operations: {
      normalizeLayerOpacity({ updateSelectedItems }) {
        updateSelectedItems((item) => ({
          data: { ...item.data, opacity: Math.max(0, Math.min(1, item.data?.opacity ?? 1)) },
        }));
      },
    },
  };
}

export function createStoryTimelineExtension(): TimelineEditorExtension<TimelineStoryItemData> {
  return {
    id: "timeline-story",
    itemKinds: ["story-scene", "story-beat", "story-chapter"],
    domains: ["story"],
    renderItem: ({ item }) => <span>{item.data?.storyElementType ?? item.label}</span>,
  };
}

export function createSubtitleTimelineExtension(): TimelineEditorExtension<TimelineSubtitleItemData> {
  return {
    id: "timeline-subtitles",
    itemKinds: ["subtitle", "caption"],
    domains: ["subtitle"],
    mediaTypes: ["text"],
    renderItem: ({ item }) => <span>{item.data?.text ?? item.label}</span>,
  };
}

export function createMediaEditorExtension(): TimelineEditorExtension<MediaClipData> {
  return {
    id: "media-editor",
    itemKinds: ["media-clip"],
    domains: ["media"],
    mediaTypes: ["video", "audio", "image", "text", "numeric-data"],
    renderItem: ({ item }) => <span>{item.label}</span>,
  };
}
```

These factories are examples of adapter shape. Product-grade behavior should
live in the corresponding domain packages.
