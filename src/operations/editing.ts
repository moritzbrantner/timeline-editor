import {
  clampTimelineEditorTime,
  getTimelineEditorItemEndMs,
  snapTimelineEditorTime,
} from "../time";
import {
  defaultTimelineEditorMinItemDurationMs,
  type TimelineEditorItem,
  type TimelineEditorOperationOptions,
  type TimelineEditorTrack,
} from "../types";
import { findTimelineEditorItem } from "./find";
import { normalizeTimelineEditorTracks } from "./normalize";
import { getSnapMs } from "./snap";

export type TimelineEditorSlipAdapter<TItemData = Record<string, unknown>> = {
  getSourceOffsetMs: (item: TimelineEditorItem<TItemData>) => number | undefined;
  setSourceOffsetMs: (item: TimelineEditorItem<TItemData>, sourceOffsetMs: number) => TItemData;
  getSourceDurationMs?: (item: TimelineEditorItem<TItemData>) => number | undefined;
};

export type TimelineEditorSlipInput = {
  itemId: string;
  deltaMs: number;
};

export function rollTimelineEditorBoundary<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  itemId: string,
  edge: "start" | "end",
  timeMs: number,
  options: TimelineEditorOperationOptions = {},
): Array<TimelineEditorTrack<TTrackData, TItemData>> {
  const found = findTimelineEditorItem(tracks, itemId);

  if (!found || found.item.locked || found.track.locked) {
    return tracks;
  }

  const orderedItems = [...found.track.items].sort(
    (left, right) => left.startMs - right.startMs || left.id.localeCompare(right.id),
  );
  const itemIndex = orderedItems.findIndex((item) => item.id === itemId);
  const leftItem = edge === "end" ? orderedItems[itemIndex] : orderedItems[itemIndex - 1];
  const rightItem = edge === "end" ? orderedItems[itemIndex + 1] : orderedItems[itemIndex];

  if (
    !leftItem ||
    !rightItem ||
    leftItem.locked ||
    rightItem.locked ||
    getTimelineEditorItemEndMs(leftItem) !== rightItem.startMs
  ) {
    return tracks;
  }

  const minItemDurationMs = options.minItemDurationMs ?? defaultTimelineEditorMinItemDurationMs;
  const outerEndMs = getTimelineEditorItemEndMs(rightItem);
  const minBoundaryMs = leftItem.startMs + minItemDurationMs;
  const maxBoundaryMs = outerEndMs - minItemDurationMs;

  if (minBoundaryMs > maxBoundaryMs) {
    return tracks;
  }

  const boundaryMs = clampTimelineEditorTime(
    snapTimelineEditorTime(timeMs, getSnapMs(options)),
    minBoundaryMs,
    maxBoundaryMs,
  );

  if (boundaryMs === rightItem.startMs) {
    return tracks;
  }

  return normalizeTimelineEditorTracks(
    tracks.map((track) =>
      track.id === found.track.id
        ? {
            ...track,
            items: track.items.map((item) => {
              if (item.id === leftItem.id) {
                return { ...item, durationMs: boundaryMs - leftItem.startMs };
              }
              if (item.id === rightItem.id) {
                return {
                  ...item,
                  startMs: boundaryMs,
                  durationMs: outerEndMs - boundaryMs,
                };
              }
              return item;
            }),
          }
        : track,
    ),
    options,
  );
}

export function slipTimelineEditorItem<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  input: TimelineEditorSlipInput,
  adapter: TimelineEditorSlipAdapter<TItemData>,
): Array<TimelineEditorTrack<TTrackData, TItemData>> {
  const found = findTimelineEditorItem(tracks, input.itemId);

  if (
    !found ||
    found.item.locked ||
    found.track.locked ||
    !Number.isFinite(input.deltaMs) ||
    input.deltaMs === 0
  ) {
    return tracks;
  }

  const currentOffsetMs = adapter.getSourceOffsetMs(found.item);
  if (!Number.isFinite(currentOffsetMs)) {
    return tracks;
  }

  const sourceDurationMs = adapter.getSourceDurationMs?.(found.item);
  const maxOffsetMs = Number.isFinite(sourceDurationMs)
    ? Math.max(0, Number(sourceDurationMs) - found.item.durationMs)
    : Number.POSITIVE_INFINITY;
  const sourceOffsetMs = clampTimelineEditorTime(
    Number(currentOffsetMs) + input.deltaMs,
    0,
    maxOffsetMs,
  );

  if (sourceOffsetMs === currentOffsetMs) {
    return tracks;
  }

  const nextData = adapter.setSourceOffsetMs(found.item, sourceOffsetMs);

  return tracks.map((track) =>
    track.id === found.track.id
      ? {
          ...track,
          items: track.items.map((item) =>
            item.id === found.item.id ? { ...item, data: nextData } : item,
          ),
        }
      : track,
  );
}
