export type TimelineEditorItemKind = string;

export type TimelineEditorItem<TData = Record<string, unknown>> = {
  id: string;
  trackId: string;
  label: string;
  startMs: number;
  durationMs: number;
  kind?: TimelineEditorItemKind;
  color?: string;
  locked?: boolean;
  data?: TData;
};

export type TimelineEditorTrack<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = {
  id: string;
  label: string;
  items: Array<TimelineEditorItem<TItemData>>;
  acceptsItemKinds?: TimelineEditorItemKind[];
  height?: number;
  locked?: boolean;
  data?: TTrackData;
};

export type TimelineEditorTrackGroup<TData = Record<string, unknown>> = {
  id: string;
  label: string;
  trackIds: string[];
  collapsed?: boolean;
  locked?: boolean;
  data?: TData;
};

export type TimelineEditorMarker = {
  id: string;
  timeMs: number;
  label?: string;
  color?: string;
};

export type TimelineEditorDocument<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
> = {
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>;
  groups?: Array<TimelineEditorTrackGroup<TGroupData>>;
  durationMs?: number;
  currentTimeMs?: number;
  markers?: TimelineEditorMarker[];
};

export type TimelineEditorSelection = {
  itemIds: string[];
  anchorItemId?: string;
};

export type TimelineEditorViewport = {
  pixelsPerSecond: number;
  scrollLeftMs?: number;
  visibleStartMs?: number;
  visibleEndMs?: number;
};

export type TimelineEditorSnapTarget =
  | { type: "interval"; intervalMs: number }
  | { type: "marker" }
  | { type: "item-edge" }
  | { type: "playhead" }
  | { type: "custom"; id: string; timesMs: number[] };

export type TimelineEditorSnapOptions = {
  enabled: boolean;
  thresholdPx: number;
  targets: TimelineEditorSnapTarget[];
};

export type TimelineEditorEditPolicy = {
  overlap: "allow" | "prevent" | "push";
  ripple: boolean;
};

export type TimelineEditorOperationOptions = {
  durationMs?: number;
  minItemDurationMs?: number;
  snapMs?: number;
  snap?: Partial<TimelineEditorSnapOptions>;
  editPolicy?: Partial<TimelineEditorEditPolicy>;
};

export type TimelineEditorMoveItemInput = {
  itemId: string;
  startMs?: number;
  trackId?: string;
};

export type TimelineEditorResizeItemInput = {
  itemId: string;
  edge: "start" | "end";
  startMs?: number;
  durationMs?: number;
};

export type TimelineEditorSplitItemInput = {
  itemId: string;
  timeMs: number;
};

export type TimelineEditorDuplicateItemInput = {
  itemId: string;
  startMs?: number;
  trackId?: string;
  createId?: (itemId: string, existingIds: ReadonlySet<string>) => string;
};

export type TimelineEditorOverlap = {
  trackId: string;
  firstItemId: string;
  secondItemId: string;
  overlapStartMs: number;
  overlapEndMs: number;
};

export type FoundTimelineEditorItem<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = {
  item: TimelineEditorItem<TItemData>;
  track: TimelineEditorTrack<TTrackData, TItemData>;
};

export type TimelineEditorTick = {
  timeMs: number;
  label: string;
  major: boolean;
};

export type TimelineEditorValidationIssue = {
  path: string;
  code: string;
  message: string;
  severity: "error" | "warning";
};

export const defaultTimelineEditorMinItemDurationMs = 100;
export const defaultTimelineEditorSnapMs = 100;
export const defaultTimelineEditorSnapThresholdPx = 8;

export const defaultTimelineEditorSelection: TimelineEditorSelection = {
  itemIds: [],
};

export const defaultTimelineEditorEditPolicy: TimelineEditorEditPolicy = {
  overlap: "allow",
  ripple: false,
};
