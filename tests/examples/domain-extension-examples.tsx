import { useState } from "react";

import {
  TimelineWorkbench,
  formatTimelineEditorTimeMs,
  type TimelineEditorDocument,
  type TimelineEditorExtension,
  type TimelineEditorSelection,
} from "@moritzbrantner/timeline-editor";
import type { TimelineMediaSourceRef } from "@moritzbrantner/timeline-editor/media-types";

export type TimelineMapItemData = {
  domain: "map";
  mediaType?: "numeric-data";
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

export type MediaTrackData = {
  domain: "media";
  role?: "video" | "audio" | "image" | "text" | "data" | "mixed";
  metadata?: Record<string, unknown>;
};

export type RenderSettings = {
  width?: number;
  height?: number;
  frameRate?: number;
  sampleRate?: number;
  format?: string;
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

export type MediaEditorProject = {
  id: string;
  timeline: TimelineEditorDocument<MediaTrackData, MediaClipData>;
  assets: MediaAsset[];
  renderSettings: RenderSettings;
};

type DomainItemData =
  | TimelineMapItemData
  | TimelineStoryItemData
  | TimelineSubtitleItemData
  | MediaClipData;

type DomainTrackData = MediaTrackData | Record<string, unknown>;

export function createMapTimelineExtension(): TimelineEditorExtension<
  DomainItemData,
  DomainTrackData
> {
  return {
    id: "timeline-map",
    itemKinds: ["map", "map-layer", "map-camera"],
    domains: ["map"],
    renderItem: ({ item }) => {
      const data = item.data?.domain === "map" ? item.data : undefined;

      return <span>{data?.layerId ?? data?.layerType ?? item.label}</span>;
    },
    renderPreview: ({ items, currentTimeMs }) => (
      <div>
        {formatTimelineEditorTimeMs(currentTimeMs)} · {items.map((item) => item.label).join(", ")}
      </div>
    ),
    inspectorSections: [
      ({ selectedItem, updateSelectedItems }) =>
        selectedItem?.data?.domain === "map" ? (
          <button
            type="button"
            onClick={() =>
              updateSelectedItems((item) =>
                item.data?.domain === "map"
                  ? { data: { ...item.data, opacity: Math.max(0, item.data.opacity ?? 1) } }
                  : {},
              )
            }
          >
            Normalize opacity
          </button>
        ) : null,
    ],
    toolbarActions: [
      ({ selectedItem }) =>
        selectedItem?.data?.domain === "map" ? <button type="button">Map layer</button> : null,
    ],
    contextMenuItems: ({ item }) =>
      item.data?.domain === "map" ? [{ id: "map-zoom-to", label: "Zoom to layer" }] : [],
    operations: {
      clampOpacity({ updateSelectedItems }) {
        updateSelectedItems((item) =>
          item.data?.domain === "map"
            ? {
                data: {
                  ...item.data,
                  opacity: Math.max(0, Math.min(1, item.data.opacity ?? 1)),
                },
              }
            : {},
        );
      },
    },
  };
}

export function createStoryTimelineExtension(): TimelineEditorExtension<
  DomainItemData,
  DomainTrackData
> {
  return {
    id: "timeline-story",
    itemKinds: ["story-scene", "story-beat", "story-chapter"],
    domains: ["story"],
    renderItem: ({ item }) => (
      <span>
        {item.data?.domain === "story" ? item.data.storyElementType : "story"} · {item.label}
      </span>
    ),
    renderPreview: ({ items }) => (
      <div>
        {items.map((item) => (item.data?.domain === "story" ? item.data.text : item.label))}
      </div>
    ),
    inspectorSections: [
      ({ selectedItem }) =>
        selectedItem?.data?.domain === "story" ? (
          <section>{selectedItem.data.storyId ?? "Story item"}</section>
        ) : null,
    ],
    toolbarActions: [
      ({ selectedItem }) =>
        selectedItem?.data?.domain === "story" ? <button type="button">Story beat</button> : null,
    ],
    contextMenuItems: ({ item }) =>
      item.data?.domain === "story" ? [{ id: "story-open", label: "Open story" }] : [],
    operations: {
      markStoryReviewed({ updateSelectedItems }) {
        updateSelectedItems((item) =>
          item.data?.domain === "story"
            ? { data: { ...item.data, metadata: { ...item.data.metadata, reviewed: true } } }
            : {},
        );
      },
    },
  };
}

export function createSubtitleTimelineExtension(): TimelineEditorExtension<
  DomainItemData,
  DomainTrackData
> {
  return {
    id: "timeline-subtitles",
    itemKinds: ["subtitle", "caption"],
    domains: ["subtitle"],
    mediaTypes: ["text"],
    renderItem: ({ item }) => (
      <span>{item.data?.domain === "subtitle" ? item.data.text : item.label}</span>
    ),
    renderPreview: ({ items }) => (
      <div>
        {items.map((item) => (item.data?.domain === "subtitle" ? item.data.text : item.label))}
      </div>
    ),
    inspectorSections: [
      ({ selectedItem }) =>
        selectedItem?.data?.domain === "subtitle" ? (
          <section>{selectedItem.data.language ?? "Subtitle"}</section>
        ) : null,
    ],
    toolbarActions: [
      ({ selectedItem }) =>
        selectedItem?.data?.domain === "subtitle" ? (
          <button type="button">Subtitle sync</button>
        ) : null,
    ],
    contextMenuItems: ({ item }) =>
      item.data?.domain === "subtitle" ? [{ id: "subtitle-split", label: "Split cue" }] : [],
    operations: {
      clearSpeaker({ updateSelectedItems }) {
        updateSelectedItems((item) =>
          item.data?.domain === "subtitle" ? { data: { ...item.data, speaker: undefined } } : {},
        );
      },
    },
  };
}

export function createMediaEditorExtension(): TimelineEditorExtension<
  DomainItemData,
  DomainTrackData
> {
  return {
    id: "media-editor",
    itemKinds: ["media-clip"],
    domains: ["media"],
    mediaTypes: ["video", "audio", "image", "text", "numeric-data"],
    renderItem: ({ item }) => (
      <span>{item.data?.domain === "media" ? item.data.assetId : item.label}</span>
    ),
    renderPreview: ({ items }) => <div>{items.map((item) => item.label).join(", ")}</div>,
    inspectorSections: [
      ({ selectedItem }) =>
        selectedItem?.data?.domain === "media" ? (
          <section>{selectedItem.data.mediaType}</section>
        ) : null,
    ],
    toolbarActions: [
      ({ selectedItem }) =>
        selectedItem?.data?.domain === "media" ? <button type="button">Media clip</button> : null,
    ],
    contextMenuItems: ({ item }) =>
      item.data?.domain === "media" ? [{ id: "media-relink", label: "Relink asset" }] : [],
    operations: {
      muteSelected({ updateSelectedItems }) {
        updateSelectedItems((item) =>
          item.data?.domain === "media" && item.data.mediaType === "audio"
            ? { data: { ...item.data, muted: true } }
            : {},
        );
      },
    },
  };
}

const document: TimelineEditorDocument<DomainTrackData, DomainItemData> = {
  durationMs: 12_000,
  currentTimeMs: 1_500,
  tracks: [
    {
      id: "map",
      label: "Map",
      acceptsItemKinds: ["map-layer", "map-camera"],
      items: [
        {
          id: "route",
          trackId: "map",
          label: "Route",
          kind: "map-layer",
          startMs: 0,
          durationMs: 3_000,
          data: { domain: "map", layerType: "route", layerId: "route-main" },
        },
      ],
    },
    {
      id: "story",
      label: "Story",
      acceptsItemKinds: ["story-scene", "story-beat"],
      items: [
        {
          id: "opening",
          trackId: "story",
          label: "Opening",
          kind: "story-scene",
          startMs: 1_000,
          durationMs: 2_000,
          data: { domain: "story", storyElementType: "scene", text: "Opening scene" },
        },
      ],
    },
    {
      id: "subtitles",
      label: "Subtitles",
      acceptsItemKinds: ["subtitle"],
      items: [
        {
          id: "cue",
          trackId: "subtitles",
          label: "Cue",
          kind: "subtitle",
          startMs: 1_000,
          durationMs: 1_500,
          data: { domain: "subtitle", mediaType: "text", text: "Hello timeline" },
        },
      ],
    },
    {
      id: "media",
      label: "Media",
      acceptsItemKinds: ["media-clip"],
      data: { domain: "media", role: "mixed" },
      items: [
        {
          id: "clip",
          trackId: "media",
          label: "Clip",
          kind: "media-clip",
          startMs: 2_000,
          durationMs: 4_000,
          data: { domain: "media", mediaType: "video", assetId: "asset-video" },
        },
      ],
    },
  ],
};

export function DomainExtensionsWorkbenchExample() {
  const [currentDocument, setCurrentDocument] = useState(document);
  const [selection, setSelection] = useState<TimelineEditorSelection>({ itemIds: [] });

  return (
    <TimelineWorkbench
      document={currentDocument}
      selection={selection}
      extensions={[
        createMapTimelineExtension(),
        createStoryTimelineExtension(),
        createSubtitleTimelineExtension(),
        createMediaEditorExtension(),
      ]}
      onDocumentChange={setCurrentDocument}
      onSelectionChange={setSelection}
    />
  );
}
