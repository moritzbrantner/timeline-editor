import type { CSSProperties, ReactNode } from "react";

import type { MenuActionItem } from "@moritzbrantner/ui";

import type {
  TimelineEditorDocument,
  TimelineEditorEditPolicy,
  TimelineEditorClipboard,
  TimelineEditorItem,
  TimelineEditorItemKind,
  TimelineEditorMarker,
  TimelineEditorSelection,
  TimelineEditorSnapOptions,
  TimelineEditorTimeRange,
  TimelineEditorTool,
  TimelineEditorTrack,
  TimelineEditorViewport,
} from "../../core";
import type { TimelineMediaType } from "../../media-types";
import type {
  TimelineEditorHotkeys,
  TimelineEditorItemRenderContext,
  TimelineEditorTimelineContextMenuContext,
} from "../timeline-editor";
import type { TimelineEditorVirtualizationOptions } from "../timeline-editor/types";

export type TimelineWorkbenchAsset<TData = Record<string, unknown>> = {
  id: string;
  label: string;
  kind?: TimelineEditorItemKind;
  mediaType?: TimelineMediaType;
  durationMs: number;
  color?: string;
  description?: string;
  data?: TData;
};

export type TimelineWorkbenchImportSource<
  TReference = unknown,
  TMetadata = Record<string, unknown>,
> = {
  type: "file" | "url" | "reference";
  file?: File;
  url?: string;
  reference?: TReference;
  label?: string;
  kind?: TimelineEditorItemKind;
  mediaType?: TimelineMediaType;
  durationMs?: number;
  metadata?: TMetadata;
};

export type TimelineWorkbenchImportResult<TAssetData = Record<string, unknown>> = {
  asset: TimelineWorkbenchAsset<TAssetData>;
  warnings?: string[];
  errors?: string[];
  metadata?: Record<string, unknown>;
};

export type TimelineWorkbenchImportState = {
  status: "idle" | "importing" | "ready" | "failed";
  sourceLabel?: string;
  error?: string;
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
  setCurrentTime: (timeMs?: number) => void;
  addMarker: (timeMs?: number) => void;
  updateMarker: (markerId: string, patch: Partial<TimelineEditorMarker>) => void;
  removeMarker: (markerId: string) => void;
  setRange: (range?: TimelineEditorTimeRange, trackIds?: string[]) => void;
  deleteRange: (range?: TimelineEditorTimeRange) => void;
  insertGap: (trackId: string, startMs: number, durationMs: number) => void;
  closeGap: (trackId: string, startMs: number, endMs: number) => void;
  updateSelectedItem: (patch: Partial<TimelineEditorItem<TData>>) => void;
  updateSelectedItems: (
    patch:
      | Partial<TimelineEditorItem<TData>>
      | ((item: TimelineEditorItem<TData>) => Partial<TimelineEditorItem<TData>>),
  ) => void;
};

export type TimelinePreviewContext<TItemData = Record<string, unknown>> = {
  currentTimeMs: number;
  document: TimelineEditorDocument<Record<string, unknown>, TItemData>;
  durationMs: number;
  items: Array<TimelineEditorItem<TItemData>>;
  selectedItems: Array<TimelineEditorItem<TItemData>>;
};

export type TimelineInspectorSectionFactory<
  TItemData = Record<string, unknown>,
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
> = (
  context: TimelineWorkbenchInspectorContext<TItemData> & {
    selectedTrack?: TimelineEditorTrack<TTrackData, TItemData>;
  },
) => ReactNode;

export type TimelineToolbarActionFactory<TItemData = Record<string, unknown>> = (
  context: TimelineWorkbenchInspectorContext<TItemData>,
) => ReactNode;

export type TimelineContextMenuFactory<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = (context: TimelineWorkbenchItemContextMenuContext<TTrackData, TItemData>) => MenuActionItem[];

export type TimelineWorkbenchTimelineContextMenuContext<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TAssetData = Record<string, unknown>,
> = TimelineEditorTimelineContextMenuContext<TTrackData, TItemData> & {
  currentTimeMs: number;
  setCurrentTime: (timeMs?: number) => void;
  addMarker: (timeMs?: number) => void;
  insertAsset: (
    asset: TimelineWorkbenchAsset<TAssetData>,
    placement?: { trackId?: string; timeMs?: number },
  ) => void;
};

export type TimelineWorkbenchTimelineContextMenuFactory<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TAssetData = Record<string, unknown>,
> = (
  context: TimelineWorkbenchTimelineContextMenuContext<TTrackData, TItemData, TAssetData>,
) => MenuActionItem[];

export type TimelineExtensionOperations<TItemData = Record<string, unknown>> = Record<
  string,
  (context: TimelineWorkbenchInspectorContext<TItemData>) => void
>;

export type TimelineEditorExtension<
  TItemData = Record<string, unknown>,
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TAssetData = Record<string, unknown>,
> = {
  id: string;
  itemKinds?: string[];
  mediaTypes?: TimelineMediaType[];
  trackKinds?: string[];
  renderItem?: (context: TimelineEditorItemRenderContext<TItemData>) => ReactNode;
  renderPreview?: (context: TimelinePreviewContext<TItemData>) => ReactNode;
  inspectorSections?: Array<TimelineInspectorSectionFactory<TItemData, TTrackData>>;
  toolbarActions?: Array<TimelineToolbarActionFactory<TItemData>>;
  contextMenuItems?: TimelineContextMenuFactory<TTrackData, TItemData>;
  timelineContextMenuItems?: TimelineWorkbenchTimelineContextMenuFactory<
    TTrackData,
    TItemData,
    TAssetData
  >;
  operations?: TimelineExtensionOperations<TItemData>;
};

export type TimelineWorkbenchInspectorSchema<TData = Record<string, unknown>> = {
  itemFields?: Array<{
    id: string;
    label: string;
    type: "text" | "number" | "boolean" | "color";
    dataKey?: keyof TData & string;
  }>;
};

export type TimelineWorkbenchItemContextMenuContext<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = {
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
  item: TimelineEditorItem<TItemData>;
  itemIds: string[];
  itemKind?: TimelineEditorItemKind;
  mediaType?: TimelineMediaType;
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
  editPolicy?: Partial<TimelineEditorEditPolicy>;
  snapMs?: number;
  snap?: Partial<TimelineEditorSnapOptions>;
  onSnapChange?: (snap: Partial<TimelineEditorSnapOptions>) => void;
  minItemDurationMs?: number;
  tool?: TimelineEditorTool;
  onToolChange?: (tool: TimelineEditorTool) => void;
  virtualization?: TimelineEditorVirtualizationOptions;
  clipboard?: TimelineEditorClipboard<TItemData>;
  onClipboardChange?: (clipboard: TimelineEditorClipboard<TItemData> | undefined) => void;
  hotkeys?: Partial<TimelineEditorHotkeys>;
  onHotkeysChange?: (hotkeys: Partial<TimelineEditorHotkeys>) => void;
  extensions?: Array<TimelineEditorExtension<TItemData, TTrackData, TAssetData>>;
  inspectorSchema?: TimelineWorkbenchInspectorSchema<TItemData>;
  assets?: Array<TimelineWorkbenchAsset<TAssetData>>;
  onImportAssets?: (
    sources: TimelineWorkbenchImportSource[],
  ) =>
    | Promise<Array<TimelineWorkbenchImportResult<TAssetData>>>
    | Array<TimelineWorkbenchImportResult<TAssetData>>;
  acceptedImportTypes?: string[];
  allowUrlImport?: boolean;
  className?: string;
  style?: CSSProperties;
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
  getTimelineContextMenuItems?: (
    context: TimelineWorkbenchTimelineContextMenuContext<TTrackData, TItemData, TAssetData>,
  ) => MenuActionItem[];
};
