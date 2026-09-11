import {
  clampTimelineEditorTime,
  getTimelineEditorItemEndMs,
  snapTimelineEditorTime,
} from "../time";
import {
  defaultTimelineEditorMinItemDurationMs,
  type TimelineEditorOperationOptions,
  type TimelineEditorTrack,
} from "../types";
import { findTimelineEditorItem } from "./find";
import { normalizeTimelineEditorTracks } from "./normalize";
import { enforceOverlapPolicy } from "./overlap-policy";
import { getSnapMs } from "./snap";

export function resizeTimelineEditorItems<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  itemIds: readonly string[],
  edge: "start" | "end",
  deltaMs: number,
  options: TimelineEditorOperationOptions = {},
) {
  const resizingIds = [...new Set(itemIds)];

  if (resizingIds.length === 0 || Number.isNaN(deltaMs)) {
    return tracks;
  }

  const resizingItems: Array<TimelineEditorTrack<TTrackData, TItemData>["items"][number]> = [];

  for (const itemId of resizingIds) {
    const found = findTimelineEditorItem(tracks, itemId);

    if (!found || found.item.locked || found.track.locked) {
      return tracks;
    }

    resizingItems.push(found.item);
  }

  const minItemDurationMs = options.minItemDurationMs ?? defaultTimelineEditorMinItemDurationMs;
  const durationMs = options.durationMs ?? Number.POSITIVE_INFINITY;
  const requestedDeltaMs = resolveSharedResizeDelta(
    resizingItems,
    edge,
    deltaMs,
    getSnapMs(options),
  );
  const minDeltaMs =
    edge === "start"
      ? Math.max(...resizingItems.map((item) => -item.startMs))
      : Math.max(...resizingItems.map((item) => minItemDurationMs - item.durationMs));
  const maxDeltaMs =
    edge === "start"
      ? Math.min(...resizingItems.map((item) => item.durationMs - minItemDurationMs))
      : Math.min(...resizingItems.map((item) => durationMs - getTimelineEditorItemEndMs(item)));

  if (maxDeltaMs < minDeltaMs) {
    return tracks;
  }

  const resolvedDeltaMs = clampTimelineEditorTime(requestedDeltaMs, minDeltaMs, maxDeltaMs);

  if (resolvedDeltaMs === 0) {
    return tracks;
  }

  const resizingIdSet = new Set(resizingIds);
  const plannedItems = new Map<
    string,
    TimelineEditorTrack<TTrackData, TItemData>["items"][number]
  >();
  const nextTracks = normalizeTimelineEditorTracks(
    tracks.map((track) => {
      if (!track.items.some((item) => resizingIdSet.has(item.id))) {
        return track;
      }

      return {
        ...track,
        items: track.items.map((item) => {
          if (!resizingIdSet.has(item.id)) {
            return item;
          }

          const resizedItem =
            edge === "start"
              ? {
                  ...item,
                  startMs: item.startMs + resolvedDeltaMs,
                  durationMs: item.durationMs - resolvedDeltaMs,
                }
              : { ...item, durationMs: item.durationMs + resolvedDeltaMs };
          plannedItems.set(item.id, resizedItem);
          return resizedItem;
        }),
      };
    }),
    options,
  );
  const acceptedTracks = enforceOverlapPolicy(nextTracks, tracks, options);

  if (acceptedTracks === tracks || !hasPlannedResize(acceptedTracks, plannedItems)) {
    return tracks;
  }

  return acceptedTracks;
}

function resolveSharedResizeDelta(
  items: Array<{ id: string; startMs: number; durationMs: number }>,
  edge: "start" | "end",
  deltaMs: number,
  snapMs: number,
) {
  return items
    .map((item) => {
      const edgeTimeMs = edge === "start" ? item.startMs : getTimelineEditorItemEndMs(item);
      return {
        item,
        deltaMs: snapTimelineEditorTime(edgeTimeMs + deltaMs, snapMs) - edgeTimeMs,
      };
    })
    .reduce((current, candidate) => {
      const currentDistance = Math.abs(current.deltaMs - deltaMs);
      const candidateDistance = Math.abs(candidate.deltaMs - deltaMs);

      if (candidateDistance < currentDistance) {
        return candidate;
      }

      if (candidateDistance > currentDistance) {
        return current;
      }

      const currentEdgeMs =
        edge === "start" ? current.item.startMs : getTimelineEditorItemEndMs(current.item);
      const candidateEdgeMs =
        edge === "start" ? candidate.item.startMs : getTimelineEditorItemEndMs(candidate.item);

      if (candidateEdgeMs !== currentEdgeMs) {
        return candidateEdgeMs < currentEdgeMs ? candidate : current;
      }

      return candidate.item.id < current.item.id ? candidate : current;
    }).deltaMs;
}

function hasPlannedResize<TTrackData, TItemData>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  plannedItems: ReadonlyMap<string, TimelineEditorTrack<TTrackData, TItemData>["items"][number]>,
) {
  for (const [itemId, plannedItem] of plannedItems) {
    const found = findTimelineEditorItem(tracks, itemId);

    if (
      !found ||
      found.track.id !== plannedItem.trackId ||
      found.item.startMs !== plannedItem.startMs ||
      found.item.durationMs !== plannedItem.durationMs
    ) {
      return false;
    }
  }

  return true;
}
