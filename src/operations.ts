import {
  clampTimelineEditorTime,
  getTimelineEditorItemEndMs,
  snapTimelineEditorTime,
} from "./time";
import {
  defaultTimelineEditorEditPolicy,
  defaultTimelineEditorMinItemDurationMs,
  type FoundTimelineEditorItem,
  type TimelineEditorDocument,
  type TimelineEditorDuplicateItemInput,
  type TimelineEditorItem,
  type TimelineEditorMarker,
  type TimelineEditorMoveItemInput,
  type TimelineEditorOperationOptions,
  type TimelineEditorOverlap,
  type TimelineEditorResizeItemInput,
  type TimelineEditorSplitItemInput,
  type TimelineEditorTrack,
} from "./types";

export function findTimelineEditorItem<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  itemId: string,
): FoundTimelineEditorItem<TTrackData, TItemData> | undefined {
  for (const track of tracks) {
    const item = track.items.find((candidate) => candidate.id === itemId);

    if (item) {
      return { item, track };
    }
  }

  return undefined;
}

export function canPlaceTimelineEditorItemOnTrack<TTrackData, TItemData>(
  item: TimelineEditorItem<TItemData>,
  track: TimelineEditorTrack<TTrackData, TItemData>,
) {
  if (track.locked) {
    return false;
  }

  if (!track.acceptsItemKinds || !item.kind) {
    return true;
  }

  return track.acceptsItemKinds.includes(item.kind);
}

export function normalizeTimelineEditorTracks<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  options: TimelineEditorOperationOptions = {},
): Array<TimelineEditorTrack<TTrackData, TItemData>> {
  const durationMs = options.durationMs ?? Number.POSITIVE_INFINITY;
  const minItemDurationMs = options.minItemDurationMs ?? defaultTimelineEditorMinItemDurationMs;

  return tracks.map((track) => ({
    ...track,
    items: track.items
      .map((item) => {
        const maxStartMs = Math.max(0, durationMs - minItemDurationMs);
        const startMs = clampTimelineEditorTime(item.startMs, 0, maxStartMs);
        const durationLimitMs = Number.isFinite(durationMs)
          ? Math.max(minItemDurationMs, durationMs - startMs)
          : Number.POSITIVE_INFINITY;
        const durationMsForItem = clampTimelineEditorTime(
          item.durationMs,
          minItemDurationMs,
          durationLimitMs,
        );

        return {
          ...item,
          trackId: track.id,
          startMs,
          durationMs: durationMsForItem,
        };
      })
      .sort((left, right) => left.startMs - right.startMs || left.id.localeCompare(right.id)),
  }));
}

export function normalizeTimelineEditorDocument<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  options: TimelineEditorOperationOptions = {},
) {
  const durationMs = options.durationMs ?? document.durationMs;

  return {
    ...document,
    tracks: normalizeTimelineEditorTracks(document.tracks, { ...options, durationMs }),
    markers: document.markers
      ?.map((marker) => ({
        ...marker,
        timeMs: clampTimelineEditorTime(marker.timeMs, 0, durationMs ?? Number.POSITIVE_INFINITY),
      }))
      .sort((left, right) => left.timeMs - right.timeMs || left.id.localeCompare(right.id)),
  };
}

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

  return normalizeTimelineEditorTracks(
    tracks.map((track) =>
      track.id === found.track.id
        ? {
            ...track,
            items: track.items.flatMap((item) =>
              item.id === found.item.id
                ? [
                    { ...item, durationMs: splitTimeMs - item.startMs },
                    {
                      ...item,
                      id: secondItemId,
                      startMs: splitTimeMs,
                      durationMs: itemEndMs - splitTimeMs,
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
    startMs: input.startMs ?? getTimelineEditorItemEndMs(found.item),
  };

  return normalizeTimelineEditorTracks(
    tracks.map((track) =>
      track.id === targetTrack.id ? { ...track, items: [...track.items, duplicate] } : track,
    ),
    options,
  );
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

  return normalizeTimelineEditorTracks(
    tracks.map((track) =>
      track.id === targetTrack.id ? { ...track, items: [...track.items, item] } : track,
    ),
    options,
  );
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
>(tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>, itemIds: readonly string[]) {
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

export function detectTimelineEditorOverlaps<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>) {
  const overlaps: TimelineEditorOverlap[] = [];

  for (const track of tracks) {
    const items = [...track.items].sort((left, right) => left.startMs - right.startMs);

    for (let index = 1; index < items.length; index += 1) {
      const previousItem = items[index - 1]!;
      const item = items[index]!;
      const overlapStartMs = Math.max(previousItem.startMs, item.startMs);
      const overlapEndMs = Math.min(
        getTimelineEditorItemEndMs(previousItem),
        getTimelineEditorItemEndMs(item),
      );

      if (overlapEndMs > overlapStartMs) {
        overlaps.push({
          trackId: track.id,
          firstItemId: previousItem.id,
          secondItemId: item.id,
          overlapStartMs,
          overlapEndMs,
        });
      }
    }
  }

  return overlaps;
}

export function setTimelineEditorCurrentTime<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  timeMs: number,
  options: TimelineEditorOperationOptions = {},
) {
  const durationMs = options.durationMs ?? document.durationMs ?? Number.POSITIVE_INFINITY;
  const currentTimeMs = clampTimelineEditorTime(
    snapTimelineEditorTime(timeMs, getSnapMs(options)),
    0,
    durationMs,
  );

  return currentTimeMs === document.currentTimeMs ? document : { ...document, currentTimeMs };
}

export function setTimelineEditorMarkers<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  markers: TimelineEditorMarker[],
  options: TimelineEditorOperationOptions = {},
) {
  return normalizeTimelineEditorDocument({ ...document, markers }, options);
}

export function addTimelineEditorMarker<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  marker: TimelineEditorMarker,
  options: TimelineEditorOperationOptions = {},
) {
  if ((document.markers ?? []).some((candidate) => candidate.id === marker.id)) {
    return document;
  }

  return setTimelineEditorMarkers(document, [...(document.markers ?? []), marker], options);
}

export function updateTimelineEditorMarker<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  markerId: string,
  patch: Partial<TimelineEditorMarker>,
  options: TimelineEditorOperationOptions = {},
) {
  const markers = document.markers ?? [];

  if (!markers.some((marker) => marker.id === markerId)) {
    return document;
  }

  return setTimelineEditorMarkers(
    document,
    markers.map((marker) => (marker.id === markerId ? updateMarker(marker, patch) : marker)),
    options,
  );
}

export function removeTimelineEditorMarker<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>, markerId: string) {
  const markers = document.markers ?? [];

  if (!markers.some((marker) => marker.id === markerId)) {
    return document;
  }

  return {
    ...document,
    markers: markers.filter((marker) => marker.id !== markerId),
  };
}

export function rippleMoveTimelineEditorItems<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  itemIds: readonly string[],
  deltaMs: number,
  options: TimelineEditorOperationOptions = {},
) {
  const movingIds = new Set(itemIds);

  return normalizeTimelineEditorTracks(
    tracks.map((track) => {
      if (track.locked) {
        return track;
      }

      return {
        ...track,
        items: track.items.map((item) => {
          if (item.locked) {
            return item;
          }

          const shouldMove =
            movingIds.has(item.id) ||
            track.items.some(
              (candidate) =>
                movingIds.has(candidate.id) &&
                item.startMs >= getTimelineEditorItemEndMs(candidate),
            );

          return shouldMove ? updateItemStart(item, Math.max(0, item.startMs + deltaMs)) : item;
        }),
      };
    }),
    options,
  );
}

export function rippleDeleteTimelineEditorItems<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>, itemIds: readonly string[]) {
  const deletingIds = new Set(itemIds);

  return normalizeTimelineEditorTracks(
    tracks.map((track) => {
      if (track.locked) {
        return track;
      }

      const deletedDurationMs = track.items
        .filter((item) => deletingIds.has(item.id) && !item.locked)
        .reduce((durationMs, item) => durationMs + item.durationMs, 0);
      const firstDeletedStartMs = Math.min(
        Number.POSITIVE_INFINITY,
        ...track.items.filter((item) => deletingIds.has(item.id)).map((item) => item.startMs),
      );

      return {
        ...track,
        items: track.items
          .filter((item) => !deletingIds.has(item.id) || item.locked)
          .map((item) =>
            item.startMs > firstDeletedStartMs && !item.locked
              ? updateItemStart(item, Math.max(0, item.startMs - deletedDurationMs))
              : item,
          ),
      };
    }),
  );
}

export function closeTimelineEditorGap<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  trackId: string,
  startMs: number,
  endMs: number,
  options: TimelineEditorOperationOptions = {},
) {
  const gapMs = Math.max(0, endMs - startMs);

  if (gapMs === 0) {
    return tracks;
  }

  return normalizeTimelineEditorTracks(
    tracks.map((track) =>
      track.id !== trackId || track.locked
        ? track
        : {
            ...track,
            items: track.items.map((item) =>
              item.startMs >= endMs && !item.locked
                ? { ...item, startMs: Math.max(startMs, item.startMs - gapMs) }
                : item,
            ),
          },
    ),
    options,
  );
}

export function insertTimelineEditorGap<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  trackId: string,
  startMs: number,
  durationMs: number,
  options: TimelineEditorOperationOptions = {},
) {
  const gapMs = Math.max(0, durationMs);

  if (gapMs === 0) {
    return tracks;
  }

  return normalizeTimelineEditorTracks(
    tracks.map((track) =>
      track.id !== trackId || track.locked
        ? track
        : {
            ...track,
            items: track.items.map((item) =>
              item.startMs >= startMs && !item.locked
                ? { ...item, startMs: item.startMs + gapMs }
                : item,
            ),
          },
    ),
    options,
  );
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

function getSnapMs(options: TimelineEditorOperationOptions) {
  const intervalTarget = options.snap?.targets?.find((target) => target.type === "interval");
  return intervalTarget?.type === "interval" ? intervalTarget.intervalMs : (options.snapMs ?? 0);
}

function enforceOverlapPolicy<TTrackData, TItemData>(
  nextTracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  previousTracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  options: TimelineEditorOperationOptions,
) {
  const policy = { ...defaultTimelineEditorEditPolicy, ...options.editPolicy };

  if (policy.overlap === "allow" || detectTimelineEditorOverlaps(nextTracks).length === 0) {
    return nextTracks;
  }

  return previousTracks;
}

function updateMarker(marker: TimelineEditorMarker, patch: Partial<TimelineEditorMarker>) {
  return { ...marker, ...patch, id: marker.id };
}

function updateItemStart<TItemData>(item: TimelineEditorItem<TItemData>, startMs: number) {
  return { ...item, startMs };
}

function createTimelineEditorCopyId<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>, baseId: string) {
  const existingIds = new Set(tracks.flatMap((track) => track.items.map((item) => item.id)));
  let candidate = baseId;
  let index = 2;

  while (existingIds.has(candidate)) {
    candidate = `${baseId}-${index}`;
    index += 1;
  }

  return candidate;
}
