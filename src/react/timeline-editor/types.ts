import type { ComponentProps, ReactNode } from "react";

import type { MenuActionItem } from "@moritzbrantner/ui";

import type {
  TimelineEditorDocument,
  TimelineEditorEditPolicy,
  TimelineEditorItem,
  TimelineEditorSelection,
  TimelineEditorSnapOptions,
  TimelineEditorTool,
  TimelineEditorTrackGroup,
  TimelineEditorTrack,
  TimelineEditorViewport,
} from "../../types";

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
  getTrackContextMenuItems?: TimelineEditorTrackContextMenuItems<TTrackData, TItemData>;
  getTimelineContextMenuItems?: TimelineEditorTimelineContextMenuItems<TTrackData, TItemData>;
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
