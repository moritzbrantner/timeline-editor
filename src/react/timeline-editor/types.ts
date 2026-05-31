import type React from "react";
import type { ComponentProps, ComponentType, ReactNode, RefObject } from "react";

import type { MenuActionItem } from "@moritzbrantner/ui";

import type {
  TimelineEditorDocument,
  TimelineEditorEditPolicy,
  TimelineEditorItem,
  TimelineEditorSelection,
  TimelineEditorSnapOptions,
  TimelineEditorTick,
  TimelineEditorTool,
  TimelineEditorTrackGroup,
  TimelineEditorTrack,
  TimelineEditorViewport,
} from "../../types";
import type { TimelineEditorDocumentIndex } from "../../document-index";
import type { TimelineEditorMeasuredViewport, TimelineEditorVisibleRange } from "./viewport";

export type TimelineEditorHotkeys = {
  delete: string;
  nudgeLeft: string;
  nudgeRight: string;
  selectAll: string;
  zoomIn: string;
  zoomOut: string;
  addMarker?: string;
  clearSelection?: string;
  copy?: string;
  cut?: string;
  duplicate?: string;
  group?: string;
  paste?: string;
  previousFrame?: string;
  undo?: string;
  redo?: string;
  redoAlternate?: string;
  nextFrame?: string;
  split?: string;
  toolBlade?: string;
  toolPan?: string;
  toolRippleTrim?: string;
  toolSelect?: string;
  toolTrim?: string;
  ungroup?: string;
  jumpStart?: string;
  jumpEnd?: string;
  previousMarker?: string;
  nextMarker?: string;
  previousEdge?: string;
  nextEdge?: string;
  playPause?: string;
  stopPlayback?: string;
  shuttleBackward?: string;
  shuttleForward?: string;
  toggleLoop?: string;
};

export type TimelineEditorItemRenderContext<TItemData = Record<string, unknown>> = {
  item: TimelineEditorItem<TItemData>;
  selected: boolean;
  readOnly: boolean;
};

export type TimelineEditorTrackRenderContext<TTrackData = Record<string, unknown>> = {
  track: TimelineEditorTrack<TTrackData, Record<string, unknown>>;
  locked: boolean;
  collapsed: boolean;
};

export type TimelineEditorTrackGroupRenderContext<TGroupData = Record<string, unknown>> = {
  group: TimelineEditorTrackGroup<TGroupData>;
  collapsed: boolean;
  locked: boolean;
};

export type TimelineEditorTrackContextMenuContext<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = {
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
  locked: boolean;
  readOnly: boolean;
  selection: TimelineEditorSelection;
  selectedItems: Array<TimelineEditorItem<TItemData>>;
  track: TimelineEditorTrack<TTrackData, TItemData>;
};

export type TimelineEditorTrackGroupContextMenuContext<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = {
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
  group: TimelineEditorTrackGroup;
  locked: boolean;
  readOnly: boolean;
  selection: TimelineEditorSelection;
  selectedItems: Array<TimelineEditorItem<TItemData>>;
};

export type TimelineEditorTimelineContextMenuSource = "ruler" | "track-lane";

export type TimelineEditorTimelineContextMenuContext<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = {
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
  frameRate?: number;
  readOnly: boolean;
  selection: TimelineEditorSelection;
  selectedItems: Array<TimelineEditorItem<TItemData>>;
  source: TimelineEditorTimelineContextMenuSource;
  timeMs: number;
  snappedTimeMs: number;
  snapped: boolean;
  clientX: number;
  clientY: number;
  track?: TimelineEditorTrack<TTrackData, TItemData>;
  locked: boolean;
  viewport: TimelineEditorViewport;
};

export type TimelineEditorItemContextMenuContext<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = TimelineEditorItemRenderContext<TItemData> & {
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
  selection: TimelineEditorSelection;
  selectedItems: Array<TimelineEditorItem<TItemData>>;
  track: TimelineEditorTrack<TTrackData, TItemData>;
};

export type TimelineEditorItemContextMenuItems<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = (context: TimelineEditorItemContextMenuContext<TTrackData, TItemData>) => MenuActionItem[];

export type TimelineEditorTrackContextMenuItems<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = (context: TimelineEditorTrackContextMenuContext<TTrackData, TItemData>) => MenuActionItem[];

export type TimelineEditorTrackGroupContextMenuItems<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = (
  context: TimelineEditorTrackGroupContextMenuContext<TTrackData, TItemData>,
) => MenuActionItem[];

export type TimelineEditorTimelineContextMenuItems<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = (context: TimelineEditorTimelineContextMenuContext<TTrackData, TItemData>) => MenuActionItem[];

export type TimelineEditorVirtualizationOptions = {
  rows?: "auto" | boolean;
  rowOverscanPx?: number;
};

export type TimelineEditorFollowCurrentTime = "off" | "keep-visible";

export type TimelineEditorProps<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = Omit<ComponentProps<"div">, "onChange"> & {
  document: TimelineEditorDocument<TTrackData, TItemData>;
  selection?: TimelineEditorSelection;
  viewport?: TimelineEditorViewport;
  readOnly?: boolean;
  frameRate?: number;
  tool?: TimelineEditorTool;
  minItemDurationMs?: number;
  editPolicy?: Partial<TimelineEditorEditPolicy>;
  snap?: Partial<TimelineEditorSnapOptions>;
  hotkeys?: Partial<TimelineEditorHotkeys>;
  virtualization?: TimelineEditorVirtualizationOptions;
  followCurrentTime?: TimelineEditorFollowCurrentTime;
  onDocumentChange?: (document: TimelineEditorDocument<TTrackData, TItemData>) => void;
  onSelectionChange?: (selection: TimelineEditorSelection) => void;
  onViewportChange?: (viewport: TimelineEditorViewport) => void;
  onCurrentTimeChange?: (timeMs: number) => void;
  renderItem?: (context: TimelineEditorItemRenderContext<TItemData>) => ReactNode;
  renderTrackHeader?: (context: TimelineEditorTrackRenderContext<TTrackData>) => ReactNode;
  renderTrackGroupHeader?: (context: TimelineEditorTrackGroupRenderContext) => ReactNode;
  getItemContextMenuItems?: TimelineEditorItemContextMenuItems<TTrackData, TItemData>;
  getTrackGroupContextMenuItems?: TimelineEditorTrackGroupContextMenuItems<TTrackData, TItemData>;
  getTrackContextMenuItems?: TimelineEditorTrackContextMenuItems<TTrackData, TItemData>;
  getTimelineContextMenuItems?: TimelineEditorTimelineContextMenuItems<TTrackData, TItemData>;
};

export type TimelineEditorProviderProps<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = Pick<
  TimelineEditorProps<TTrackData, TItemData>,
  | "document"
  | "editPolicy"
  | "followCurrentTime"
  | "frameRate"
  | "getItemContextMenuItems"
  | "getTrackGroupContextMenuItems"
  | "getTimelineContextMenuItems"
  | "getTrackContextMenuItems"
  | "hotkeys"
  | "minItemDurationMs"
  | "onCurrentTimeChange"
  | "onDocumentChange"
  | "onSelectionChange"
  | "onViewportChange"
  | "readOnly"
  | "renderItem"
  | "renderTrackGroupHeader"
  | "renderTrackHeader"
  | "selection"
  | "snap"
  | "tool"
  | "viewport"
  | "virtualization"
> & {
  children?: ReactNode;
};

export type TimelineEditorDragState<TItemData, TSnapResolver> =
  | {
      type: "move";
      itemId: string;
      startX: number;
      originalItems: Array<TimelineEditorItem<TItemData>>;
      movingItemIds: ReadonlySet<string>;
      sourceTrackId: string;
      snapResolver: TSnapResolver;
    }
  | {
      type: "resize-start" | "resize-end";
      item: TimelineEditorItem<TItemData>;
      trackId: string;
      startX: number;
      originalStartMs: number;
      originalEndMs: number;
      snapResolver: TSnapResolver;
    };

export type TimelineEditorTrackEntry<TTrackData, TItemData> =
  | {
      type: "group";
      group: NonNullable<TimelineEditorDocument<TTrackData, TItemData>["groups"]>[number];
    }
  | {
      type: "track";
      track: TimelineEditorTrack<TTrackData, TItemData>;
      locked: boolean;
    };

export type TimelineEditorTrackRowModel<TTrackData, TItemData> = {
  entry: TimelineEditorTrackEntry<TTrackData, TItemData>;
  topPx: number;
  heightPx: number;
};

export type TimelineEditorRangeOverlayProps = {
  durationMs?: number;
  range: { startMs: number; endMs: number };
  timelineWidthPx?: number;
};

export type TimelineEditorTrackGridProps = {
  durationMs?: number;
  ticks?: TimelineEditorTick[];
  timelineWidthPx?: number;
};

export type TimelineEditorTrackGroupRowProps<TGroupData = Record<string, unknown>> = {
  group: TimelineEditorTrackGroup<TGroupData>;
  row: TimelineEditorTrackRowModel<Record<string, unknown>, unknown>;
  style?: React.CSSProperties;
};

export type TimelineEditorTrackHeaderProps<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = {
  contextMenu?: boolean;
  entry: Extract<TimelineEditorTrackEntry<TTrackData, TItemData>, { type: "track" }>;
};

export type TimelineEditorTrackLaneProps<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = {
  components?: TimelineEditorComponents<TTrackData, TItemData>;
  entry: Extract<TimelineEditorTrackEntry<TTrackData, TItemData>, { type: "track" }>;
};

export type TimelineEditorTrackRowProps<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = {
  components?: TimelineEditorComponents<TTrackData, TItemData>;
  entry: Extract<TimelineEditorTrackEntry<TTrackData, TItemData>, { type: "track" }>;
  row: TimelineEditorTrackRowModel<TTrackData, TItemData>;
  style?: React.CSSProperties;
};

export type TimelineEditorClipPublicProps<TItemData = Record<string, unknown>> = {
  item: TimelineEditorItem<TItemData>;
  contextMenuItems?: MenuActionItem[];
  durationMs?: number;
  locked?: boolean;
  readOnly?: boolean;
  selected?: boolean;
  timelineWidthPx?: number;
  track?: TimelineEditorTrack<Record<string, unknown>, TItemData>;
  renderItem?: (context: TimelineEditorItemRenderContext<TItemData>) => ReactNode;
  onContextMenu?: () => void;
  onMovePointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onResizePointerDown?: (edge: "start" | "end", event: React.PointerEvent<HTMLSpanElement>) => void;
};

export type TimelineEditorComponents<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = {
  TrackGroupRow?: ComponentType<TimelineEditorTrackGroupRowProps>;
  TrackRow?: ComponentType<TimelineEditorTrackRowProps<TTrackData, TItemData>>;
  TrackHeader?: ComponentType<TimelineEditorTrackHeaderProps<TTrackData, TItemData>>;
  TrackLane?: ComponentType<TimelineEditorTrackLaneProps<TTrackData, TItemData>>;
  TrackGrid?: ComponentType<TimelineEditorTrackGridProps>;
  Clip?: ComponentType<TimelineEditorClipPublicProps<TItemData>>;
  RangeOverlay?: ComponentType<TimelineEditorRangeOverlayProps>;
};

export type TimelineEditorTracksProps<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = {
  components?: TimelineEditorComponents<TTrackData, TItemData>;
};

export type TimelineEditorRootProps = Omit<ComponentProps<"div">, "onChange">;

export type TimelineEditorContentProps = ComponentProps<"div">;

export type TimelineEditorRulerPublicProps = ComponentProps<"div">;

export type TimelineEditorPlayheadProps = ComponentProps<"div">;

export type TimelineEditorSnapGuideProps = ComponentProps<"div">;

export type TimelineEditorSnapFeedbackProps = ComponentProps<"div">;

export type TimelineEditorLiveRegionProps = ComponentProps<"span">;

export type TimelineEditorContextValue<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = {
  document: TimelineEditorDocument<TTrackData, TItemData>;
  selection: TimelineEditorSelection;
  viewport: TimelineEditorViewport;
  readOnly: boolean;
  tool: TimelineEditorTool;
  durationMs: number;
  timelineWidthPx: number;
  editorWidthPx: number;
  frameDurationMs: number | undefined;
  nudgeMs: number;
  resolvedSnap: TimelineEditorSnapOptions;
  resolvedHotkeys: TimelineEditorHotkeys;
  visibleRange: TimelineEditorVisibleRange;
  visibleTracks: Array<TimelineEditorTrackEntry<TTrackData, TItemData>>;
  ticks: TimelineEditorTick[];
  selectedIds: ReadonlySet<string>;
  selectedItems: Array<TimelineEditorItem<TItemData>>;
  documentIndex: TimelineEditorDocumentIndex<TTrackData, TItemData>;
  renderDocument: TimelineEditorDocument<TTrackData, TItemData>;
  scrollerRef: RefObject<HTMLDivElement | null>;
  measuredViewport: TimelineEditorMeasuredViewport;
  virtualization: Required<TimelineEditorVirtualizationOptions>;
  renderItem?: (context: TimelineEditorItemRenderContext<TItemData>) => ReactNode;
  renderTrackHeader?: (context: TimelineEditorTrackRenderContext<TTrackData>) => ReactNode;
  renderTrackGroupHeader?: (context: TimelineEditorTrackGroupRenderContext) => ReactNode;
  getItemContextMenuItems?: TimelineEditorItemContextMenuItems<TTrackData, TItemData>;
  getTrackGroupContextMenuItems?: TimelineEditorTrackGroupContextMenuItems<TTrackData, TItemData>;
  getTrackContextMenuItems?: TimelineEditorTrackContextMenuItems<TTrackData, TItemData>;
  getTimelineContextMenuItems?: TimelineEditorTimelineContextMenuItems<TTrackData, TItemData>;
  getTimelineContextMenuContext: (
    source: TimelineEditorTimelineContextMenuContext<TTrackData, TItemData>["source"],
    event: React.MouseEvent<Element>,
    track?: TimelineEditorTrack<TTrackData, TItemData>,
    locked?: boolean,
  ) => TimelineEditorTimelineContextMenuContext<TTrackData, TItemData>;
  commitDocument: (document: TimelineEditorDocument<TTrackData, TItemData>) => void;
  commitSelection: (selection: TimelineEditorSelection) => void;
  commitCurrentTimeAtClientX: (clientX: number) => void;
  beginRangeSelection: (event: React.PointerEvent<Element>, trackId?: string) => boolean;
  beginTimelineScrub: (event: React.PointerEvent<Element>) => boolean;
  selectItem: (
    item: TimelineEditorItem<TItemData>,
    track: TimelineEditorTrack<TTrackData, TItemData>,
    event: React.PointerEvent,
  ) => void;
  beginClipMove: (
    item: TimelineEditorItem<TItemData>,
    track: TimelineEditorTrack<TTrackData, TItemData>,
    locked: boolean,
    event: React.PointerEvent<HTMLDivElement>,
  ) => void;
  beginClipResize: (
    edge: "start" | "end",
    item: TimelineEditorItem<TItemData>,
    locked: boolean,
    event: React.PointerEvent<HTMLSpanElement>,
  ) => void;
  beginMarkerDrag: (
    marker: NonNullable<TimelineEditorDocument<TTrackData, TItemData>["markers"]>[number],
    event: React.PointerEvent<HTMLDivElement>,
  ) => void;
  commitDrag: (event: React.PointerEvent<HTMLDivElement>) => void;
  cancelDrag: () => void;
  handlePointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  handlePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  handlePointerDownCapture: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleMouseDownCapture: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void;
  clearMouseInteraction: () => void;
  handleScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  handleWheel?: (event: React.WheelEvent<HTMLDivElement>) => void;
  handleKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  snapGuideMs: number | null;
  previewTracks: Array<TimelineEditorTrack<TTrackData, TItemData>> | null;
  schedulePreviewUpdate: (
    nextTracks: Array<TimelineEditorTrack<TTrackData, TItemData>> | null,
    nextSnapGuideMs: number | null,
  ) => void;
  clearPreview: () => void;
};
