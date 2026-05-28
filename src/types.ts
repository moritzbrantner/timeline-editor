export type TimelineEditorItemKind = string;

export type TimelineEditorTransformValues = Record<string, number>;

export const timelineEditorTransformEasings = [
  "linear",
  "hold",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "quadratic",
  "quadratic-in",
  "quadratic-out",
  "quadratic-in-out",
  "cubic",
  "cubic-in",
  "cubic-out",
  "cubic-in-out",
  "quartic",
  "quartic-in",
  "quartic-out",
  "quartic-in-out",
] as const;

export type TimelineEditorTransformEasing = (typeof timelineEditorTransformEasings)[number];

export function isTimelineEditorTransformEasing(
  input: unknown,
): input is TimelineEditorTransformEasing {
  return (
    typeof input === "string" &&
    timelineEditorTransformEasings.includes(input as TimelineEditorTransformEasing)
  );
}

export type TimelineEditorTransformPoint<
  TValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
> = {
  offsetMs: number;
  values: Partial<TValues>;
  easing?: TimelineEditorTransformEasing;
};

export type TimelineEditorTransformPointPatch<
  TValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
> = Partial<Omit<TimelineEditorTransformPoint<TValues>, "offsetMs">>;

export type TimelineEditorTransform<
  TValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
> = {
  points: Array<TimelineEditorTransformPoint<TValues>>;
  data?: Record<string, unknown>;
};

export type TimelineEditorItem<
  TData = Record<string, unknown>,
  TTransformValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
> = {
  id: string;
  trackId: string;
  label: string;
  startMs: number;
  durationMs: number;
  itemGroupId?: string;
  kind?: TimelineEditorItemKind;
  color?: string;
  locked?: boolean;
  transform?: TimelineEditorTransform<TTransformValues>;
  data?: TData;
};

export type TimelineEditorTrack<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TTransformValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
> = {
  id: string;
  label: string;
  kind?: TimelineEditorItemKind;
  items: Array<TimelineEditorItem<TItemData, TTransformValues>>;
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

export type TimelineEditorItemGroup<TData = Record<string, unknown>> = {
  id: string;
  label: string;
  itemIds: string[];
  data?: TData;
};

export type TimelineEditorMarker = {
  id: string;
  timeMs: number;
  label?: string;
  color?: string;
};

export type TimelineEditorTimeRange = {
  startMs: number;
  endMs: number;
};

export type TimelineEditorDocument<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
  TTransformValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
> = {
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData, TTransformValues>>;
  groups?: Array<TimelineEditorTrackGroup<TGroupData>>;
  itemGroups?: TimelineEditorItemGroup[];
  durationMs?: number;
  currentTimeMs?: number;
  markers?: TimelineEditorMarker[];
};

export type TimelineEditorSelection = {
  itemIds: string[];
  anchorItemId?: string;
  trackIds?: string[];
  markerIds?: string[];
  range?: TimelineEditorTimeRange;
};

export type TimelineEditorClipboard<
  TItemData = Record<string, unknown>,
  TTransformValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
> = {
  items: Array<TimelineEditorItem<TItemData, TTransformValues>>;
  sourceStartMs: number;
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

export type TimelineEditorTool = "select" | "blade" | "trim" | "ripple-trim" | "pan";

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
  TTransformValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
> = {
  item: TimelineEditorItem<TItemData, TTransformValues>;
  track: TimelineEditorTrack<TTrackData, TItemData, TTransformValues>;
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
