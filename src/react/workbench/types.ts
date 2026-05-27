import type { ReactNode } from "react";

import type { MenuActionItem } from "@moritzbrantner/ui";

import type {
  TimelineEditorDocument,
  TimelineEditorItem,
  TimelineEditorItemKind,
  TimelineEditorSelection,
  TimelineEditorTrack,
  TimelineEditorViewport,
} from "../../core";
import type { TimelineEditorItemRenderContext } from "../timeline-editor";
import type { TimelineEditorVirtualizationOptions } from "../timeline-editor/types";

export type TimelineWorkbenchAsset<TData = Record<string, unknown>> = {
  id: string;
  label: string;
  kind?: TimelineEditorItemKind;
  durationMs: number;
  color?: string;
  description?: string;
  data?: TData;
};

export type TimelineWorkbenchSelection<TData = Record<string, unknown>> = {
  item?: TimelineEditorItem<TData>;
  itemId?: string;
  itemIds: string[];
  track?: TimelineEditorTrack<Record<string, unknown>, TData>;
};

export type TimelineWorkbenchInspectorContext<TData = Record<string, unknown>> = {
  document: TimelineEditorDocument<Record<string, unknown>, TData>;
  durationMs: number;
  readOnly: boolean;
  selection: TimelineEditorSelection;
  selectedItem?: TimelineEditorItem<TData>;
  selectedItems: Array<TimelineEditorItem<TData>>;
  selectedTrack?: TimelineEditorTrack<Record<string, unknown>, TData>;
  updateSelectedItem: (patch: Partial<TimelineEditorItem<TData>>) => void;
};

export type TimelineWorkbenchItemContextMenuContext<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = {
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
  item: TimelineEditorItem<TItemData>;
  itemIds: string[];
  mediaType?: TimelineEditorItemKind;
  readOnly: boolean;
  selection: TimelineEditorSelection;
  selectedItems: Array<TimelineEditorItem<TItemData>>;
  track: TimelineEditorTrack<TTrackData, TItemData>;
  deleteItems: (itemIds?: string[]) => void;
  duplicateItems: (itemIds?: string[]) => void;
  groupItems: (itemIds?: string[]) => void;
  splitItems: (itemIds?: string[]) => void;
  ungroupItems: (itemIds?: string[]) => void;
  updateItem: (itemId: string, patch: Partial<TimelineEditorItem<TItemData>>) => void;
};

export type TimelineWorkbenchProps<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TAssetData = Record<string, unknown>,
> = {
  document: TimelineEditorDocument<TTrackData, TItemData>;
  selectedItemId?: string | null;
  selection?: TimelineEditorSelection;
  readOnly?: boolean;
  pixelsPerSecond?: number;
  viewport?: TimelineEditorViewport;
  frameRate?: number;
  snapMs?: number;
  virtualization?: TimelineEditorVirtualizationOptions;
  assets?: Array<TimelineWorkbenchAsset<TAssetData>>;
  className?: string;
  createItemId?: (asset: TimelineWorkbenchAsset<TAssetData>) => string;
  createMarkerId?: (timeMs: number) => string;
  onDocumentChange?: (document: TimelineEditorDocument<TTrackData, TItemData>) => void;
  onCurrentTimeChange?: (timeMs: number) => void;
  onSelectionChange?: (selection: TimelineEditorSelection) => void;
  onSelectedItemChange?: (selection: TimelineWorkbenchSelection<TItemData>) => void;
  onViewportChange?: (viewport: TimelineEditorViewport) => void;
  onAssetInsert?: (
    asset: TimelineWorkbenchAsset<TAssetData>,
    placement: { trackId: string; timeMs: number },
  ) => void;
  renderAsset?: (asset: TimelineWorkbenchAsset<TAssetData>) => ReactNode;
  renderInspector?: (context: TimelineWorkbenchInspectorContext<TItemData>) => ReactNode;
  renderTimelineItem?: (context: TimelineEditorItemRenderContext<TItemData>) => ReactNode;
  renderToolbarActions?: (context: TimelineWorkbenchInspectorContext<TItemData>) => ReactNode;
  getItemContextMenuItems?: (
    context: TimelineWorkbenchItemContextMenuContext<TTrackData, TItemData>,
  ) => MenuActionItem[];
};
