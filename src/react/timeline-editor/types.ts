import type { ComponentProps, ReactNode } from "react";

import type { MenuActionItem } from "@moritzbrantner/ui";

import type {
  TimelineEditorDocument,
  TimelineEditorItem,
  TimelineEditorSelection,
  TimelineEditorSnapOptions,
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

export type TimelineEditorVirtualizationOptions = {
  rows?: "auto" | boolean;
  rowOverscanPx?: number;
};

export type TimelineEditorProps<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = Omit<ComponentProps<"div">, "onChange"> & {
  document: TimelineEditorDocument<TTrackData, TItemData>;
  selection?: TimelineEditorSelection;
  viewport?: TimelineEditorViewport;
  readOnly?: boolean;
  frameRate?: number;
  snap?: Partial<TimelineEditorSnapOptions>;
  hotkeys?: Partial<TimelineEditorHotkeys>;
  virtualization?: TimelineEditorVirtualizationOptions;
  onDocumentChange?: (document: TimelineEditorDocument<TTrackData, TItemData>) => void;
  onSelectionChange?: (selection: TimelineEditorSelection) => void;
  onViewportChange?: (viewport: TimelineEditorViewport) => void;
  onCurrentTimeChange?: (timeMs: number) => void;
  renderItem?: (context: TimelineEditorItemRenderContext<TItemData>) => ReactNode;
  renderTrackHeader?: (context: TimelineEditorTrackRenderContext<TTrackData>) => ReactNode;
  getItemContextMenuItems?: TimelineEditorItemContextMenuItems<TTrackData, TItemData>;
  getTrackContextMenuItems?: TimelineEditorTrackContextMenuItems<TTrackData, TItemData>;
};

export type TimelineEditorDragState<TItemData, TSnapResolver> =
  | {
      type: "move";
      itemId: string;
      startX: number;
      originalItems: Array<TimelineEditorItem<TItemData>>;
      movingItemIds: ReadonlySet<string>;
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
