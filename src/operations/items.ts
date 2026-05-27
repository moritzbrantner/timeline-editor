import {
  clampTimelineEditorTime,
  getTimelineEditorItemEndMs,
  snapTimelineEditorTime,
} from "../time";
import { sliceTimelineEditorTransform } from "../transform";
import {
  defaultTimelineEditorMinItemDurationMs,
  type TimelineEditorDuplicateItemInput,
  type TimelineEditorItem,
  type TimelineEditorMoveItemInput,
  type TimelineEditorOperationOptions,
  type TimelineEditorResizeItemInput,
  type TimelineEditorSplitItemInput,
  type TimelineEditorTrack,
} from "../types";
import { enforceOverlapPolicy } from "./overlap-policy";
import { canPlaceTimelineEditorItemOnTrack, findTimelineEditorItem } from "./find";
import { insertTimelineEditorGap } from "./gaps";
import { createTimelineEditorCopyId } from "./ids";
import { normalizeTimelineEditorTrack, normalizeTimelineEditorTracks } from "./normalize";
import { rippleDeleteTimelineEditorItems } from "./ripple";
import { getSnapMs } from "./snap";

export function moveTimelineEditorItem<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  input: TimelineEditorMoveItemInput,
  options: TimelineEditorOperationOptions = {},
) {
  const found = findTimelineEditorItem(tracks, input.itemId);

  if (!found || found.item.locked || found.track.locked) {
    return tracks;
  }

  const targetTrack = tracks.find((track) => track.id === (input.trackId ?? found.track.id));

  if (!targetTrack || !canPlaceTimelineEditorItemOnTrack(found.item, targetTrack)) {
    return tracks;
  }

  const durationMs = options.durationMs ?? Number.POSITIVE_INFINITY;
  const snapMs = getSnapMs(options);
  const maxStartMs = Math.max(0, durationMs - found.item.durationMs);
  const nextStartMs = clampTimelineEditorTime(
    snapTimelineEditorTime(input.startMs ?? found.item.startMs, snapMs),
    0,
    maxStartMs,
  );

  if (nextStartMs === found.item.startMs && targetTrack.id === found.track.id) {
    return tracks;
  }

  const nextTracks = normalizeTimelineEditorTracks(
    tracks.map((track) => {
      if (track.id === found.track.id && track.id !== targetTrack.id) {
        return {
          ...track,
          items: track.items.filter((item) => item.id !== found.item.id),
        };
      }

      if (track.id !== targetTrack.id) {
        return track;
      }

      const nextItem = {
        ...found.item,
        trackId: targetTrack.id,
        startMs: nextStartMs,
      };

      if (track.id === found.track.id) {
        return {
          ...track,
          items: track.items.map((item) => (item.id === found.item.id ? nextItem : item)),
        };
      }

      return {
        ...track,
        items: [...track.items, nextItem],
      };
    }),
    options,
  );

  return enforceOverlapPolicy(nextTracks, tracks, options);
}

export function resizeTimelineEditorItem<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  input: TimelineEditorResizeItemInput,
  options: TimelineEditorOperationOptions = {},
) {
  const found = findTimelineEditorItem(tracks, input.itemId);

  if (!found || found.item.locked || found.track.locked) {
    return tracks;
  }

  const durationMs = options.durationMs ?? Number.POSITIVE_INFINITY;
  const minItemDurationMs = options.minItemDurationMs ?? defaultTimelineEditorMinItemDurationMs;
  const snapMs = getSnapMs(options);
  const originalEndMs = getTimelineEditorItemEndMs(found.item);
  let nextStartMs = found.item.startMs;
  let nextDurationMs = found.item.durationMs;

  if (input.edge === "start") {
    const maxStartMs = originalEndMs - minItemDurationMs;
    nextStartMs = clampTimelineEditorTime(
      snapTimelineEditorTime(input.startMs ?? found.item.startMs, snapMs),
      0,
      maxStartMs,
    );
    nextDurationMs = originalEndMs - nextStartMs;
  } else {
    const requestedDurationMs = input.durationMs ?? found.item.durationMs;
    const snappedEndMs = snapTimelineEditorTime(found.item.startMs + requestedDurationMs, snapMs);
    const nextEndMs = clampTimelineEditorTime(
      snappedEndMs,
      found.item.startMs + minItemDurationMs,
      durationMs,
    );
    nextDurationMs = nextEndMs - found.item.startMs;
  }

  if (nextStartMs === found.item.startMs && nextDurationMs === found.item.durationMs) {
    return tracks;
  }

  const nextTracks = normalizeTimelineEditorTracks(
    tracks.map((track) =>
      track.id === found.track.id
        ? {
            ...track,
            items: track.items.map((item) =>
              item.id === found.item.id
                ? { ...item, startMs: nextStartMs, durationMs: nextDurationMs }
                : item,
            ),
          }
        : track,
    ),
    options,
  );

  return enforceOverlapPolicy(nextTracks, tracks, options);
}

export function splitTimelineEditorItem<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  input: TimelineEditorSplitItemInput,
  options: TimelineEditorOperationOptions = {},
) {
  const found = findTimelineEditorItem(tracks, input.itemId);

  if (!found || found.item.locked || found.track.locked) {
    return tracks;
  }

  const minItemDurationMs = options.minItemDurationMs ?? defaultTimelineEditorMinItemDurationMs;
  const itemEndMs = getTimelineEditorItemEndMs(found.item);
  const splitTimeMs = clampTimelineEditorTime(
    snapTimelineEditorTime(input.timeMs, getSnapMs(options)),
    found.item.startMs + minItemDurationMs,
    itemEndMs - minItemDurationMs,
  );

  if (
    splitTimeMs < found.item.startMs + minItemDurationMs ||
    splitTimeMs > itemEndMs - minItemDurationMs
  ) {
    return tracks;
  }

  const secondItemId = createTimelineEditorCopyId(tracks, `${found.item.id}-part-2`);
  const firstDurationMs = splitTimeMs - found.item.startMs;
  const secondDurationMs = itemEndMs - splitTimeMs;

  return normalizeTimelineEditorTracks(
    tracks.map((track) =>
      track.id === found.track.id
        ? {
            ...track,
            items: track.items.flatMap((item) =>
              item.id === found.item.id
                ? [
                    {
                      ...item,
                      durationMs: firstDurationMs,
                      transform: sliceTimelineEditorTransform(item.transform, 0, firstDurationMs),
                    },
                    {
                      ...item,
                      id: secondItemId,
                      startMs: splitTimeMs,
                      durationMs: secondDurationMs,
                      transform: sliceTimelineEditorTransform(
                        item.transform,
                        firstDurationMs,
                        item.durationMs,
                      ),
                    },
                  ]
                : [item],
            ),
          }
        : track,
    ),
    options,
  );
}

export function duplicateTimelineEditorItem<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  input: TimelineEditorDuplicateItemInput,
  options: TimelineEditorOperationOptions = {},
) {
  const found = findTimelineEditorItem(tracks, input.itemId);

  if (!found || found.item.locked || found.track.locked) {
    return tracks;
  }

  const targetTrack = tracks.find((track) => track.id === (input.trackId ?? found.track.id));

  if (!targetTrack || !canPlaceTimelineEditorItemOnTrack(found.item, targetTrack)) {
    return tracks;
  }

  const existingIds = new Set(tracks.flatMap((track) => track.items.map((item) => item.id)));
  const requestedDuplicateId = input.createId?.(found.item.id, existingIds);
  const duplicateId =
    requestedDuplicateId && !existingIds.has(requestedDuplicateId)
      ? requestedDuplicateId
      : createTimelineEditorCopyId(tracks, requestedDuplicateId ?? `${found.item.id}-copy`);
  const duplicate = {
    ...found.item,
    id: duplicateId,
    trackId: targetTrack.id,
    itemGroupId: undefined,
    startMs: input.startMs ?? getTimelineEditorItemEndMs(found.item),
  };

  const nextTracks = normalizeTimelineEditorTracks(
    tracks.map((track) =>
      track.id === targetTrack.id ? { ...track, items: [...track.items, duplicate] } : track,
    ),
    options,
  );

  return enforceOverlapPolicy(nextTracks, tracks, options);
}

export function insertTimelineEditorItem<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  item: TimelineEditorItem<TItemData>,
  options: TimelineEditorOperationOptions = {},
) {
  const targetTrack = tracks.find((track) => track.id === item.trackId);

  if (!targetTrack || !canPlaceTimelineEditorItemOnTrack(item, targetTrack)) {
    return tracks;
  }

  if (findTimelineEditorItem(tracks, item.id)) {
    return tracks;
  }

  const nextTracks = normalizeTimelineEditorTracks(
    tracks.map((track) =>
      track.id === targetTrack.id ? { ...track, items: [...track.items, item] } : track,
    ),
    options,
  );

  return enforceOverlapPolicy(nextTracks, tracks, options);
}

export function removeTimelineEditorItem<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>, itemId: string) {
  const found = findTimelineEditorItem(tracks, itemId);

  if (!found || found.item.locked || found.track.locked) {
    return tracks;
  }

  return tracks.map((track) =>
    track.id === found.track.id
      ? { ...track, items: track.items.filter((item) => item.id !== itemId) }
      : track,
  );
}

export function removeTimelineEditorItems<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  itemIds: readonly string[],
  options: TimelineEditorOperationOptions = {},
) {
  if (options.editPolicy?.ripple) {
    return rippleDeleteTimelineEditorItems(tracks, itemIds, options);
  }

  let nextTracks = tracks;

  for (const itemId of itemIds) {
    nextTracks = removeTimelineEditorItem(nextTracks, itemId);
  }

  return nextTracks;
}

export function moveTimelineEditorItems<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  itemIds: readonly string[],
  deltaMs: number,
  options: TimelineEditorOperationOptions & { trackDelta?: number } = {},
) {
  if (itemIds.length === 0 || (deltaMs === 0 && options.trackDelta === undefined)) {
    return tracks;
  }

  if (options.trackDelta === undefined) {
    const movingIds = new Set(itemIds);
    const durationMs = options.durationMs ?? Number.POSITIVE_INFINITY;
    const snapMs = getSnapMs(options);
    let changed = false;

    const nextTracks = tracks.map((track) => {
      if (track.locked || !track.items.some((item) => movingIds.has(item.id))) {
        return track;
      }

      let trackChanged = false;
      const nextItems = track.items.map((item) => {
        if (!movingIds.has(item.id) || item.locked) {
          return item;
        }

        const maxStartMs = Math.max(0, durationMs - item.durationMs);
        const startMs = clampTimelineEditorTime(
          snapTimelineEditorTime(item.startMs + deltaMs, snapMs),
          0,
          maxStartMs,
        );

        if (startMs === item.startMs) {
          return item;
        }

        changed = true;
        trackChanged = true;
        return { ...item, startMs };
      });

      return trackChanged
        ? normalizeTimelineEditorTrack({ ...track, items: nextItems }, options)
        : track;
    });

    return changed ? enforceOverlapPolicy(nextTracks, tracks, options) : tracks;
  }

  let nextTracks = tracks;

  for (const itemId of itemIds) {
    const found = findTimelineEditorItem(nextTracks, itemId);

    if (!found) {
      continue;
    }

    const currentTrackIndex = nextTracks.findIndex((track) => track.id === found.track.id);
    const targetTrack =
      options.trackDelta === undefined
        ? found.track
        : nextTracks[
            clampTimelineEditorTime(
              currentTrackIndex + options.trackDelta,
              0,
              nextTracks.length - 1,
            )
          ];

    nextTracks = moveTimelineEditorItem(
      nextTracks,
      {
        itemId,
        startMs: found.item.startMs + deltaMs,
        trackId: targetTrack?.id,
      },
      options,
    );
  }

  return nextTracks;
}

export function duplicateTimelineEditorItems<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  itemIds: readonly string[],
  options: TimelineEditorOperationOptions = {},
) {
  let nextTracks = tracks;

  for (const itemId of itemIds) {
    nextTracks = duplicateTimelineEditorItem(nextTracks, { itemId }, options);
  }

  return nextTracks;
}

export function splitTimelineEditorItems<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  itemIds: readonly string[],
  timeMs: number,
  options: TimelineEditorOperationOptions = {},
) {
  let nextTracks = tracks;

  for (const itemId of itemIds) {
    nextTracks = splitTimelineEditorItem(nextTracks, { itemId, timeMs }, options);
  }

  return nextTracks;
}

export function trimTimelineEditorItem<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  itemId: string,
  edge: "start" | "end",
  timeMs: number,
  mode: "normal" | "ripple" | "roll" = "normal",
  options: TimelineEditorOperationOptions = {},
) {
  const found = findTimelineEditorItem(tracks, itemId);

  if (!found) {
    return tracks;
  }

  const beforeEndMs = getTimelineEditorItemEndMs(found.item);
  const nextTracks = resizeTimelineEditorItem(
    tracks,
    edge === "start"
      ? { itemId, edge, startMs: timeMs }
      : { itemId, edge, durationMs: timeMs - found.item.startMs },
    options,
  );

  if (mode !== "ripple" || nextTracks === tracks) {
    return nextTracks;
  }

  const nextFound = findTimelineEditorItem(nextTracks, itemId);
  const deltaMs = nextFound ? getTimelineEditorItemEndMs(nextFound.item) - beforeEndMs : 0;

  return deltaMs === 0
    ? nextTracks
    : insertTimelineEditorGap(nextTracks, found.track.id, beforeEndMs, deltaMs, options);
}
