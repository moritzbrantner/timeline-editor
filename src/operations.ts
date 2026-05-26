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
  type TimelineEditorItemGroup,
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
  return tracks.map((track) => normalizeTimelineEditorTrack(track, options));
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
  const normalizedTracks = normalizeTimelineEditorTracks(document.tracks, {
    ...options,
    durationMs,
  });
  const itemGroupCounts = new Map<string, number>();

  for (const track of normalizedTracks) {
    for (const item of track.items) {
      if (item.itemGroupId) {
        itemGroupCounts.set(item.itemGroupId, (itemGroupCounts.get(item.itemGroupId) ?? 0) + 1);
      }
    }
  }

  const validItemGroupIds = new Set(
    [...itemGroupCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([itemGroupId]) => itemGroupId),
  );
  const tracks: Array<TimelineEditorTrack<TTrackData, TItemData>> = [];

  for (const track of normalizedTracks) {
    let trackChanged = false;
    const items = track.items.map((item) => {
      if (!item.itemGroupId || validItemGroupIds.has(item.itemGroupId)) {
        return item;
      }

      trackChanged = true;
      return { ...item, itemGroupId: undefined };
    });

    tracks.push(trackChanged ? { ...track, items } : track);
  }
  const itemGroups = normalizeTimelineEditorItemGroups(document.itemGroups ?? [], tracks);

  return {
    ...document,
    tracks,
    itemGroups,
    markers: document.markers
      ?.map((marker) => ({
        ...marker,
        timeMs: clampTimelineEditorTime(marker.timeMs, 0, durationMs ?? Number.POSITIVE_INFINITY),
      }))
      .sort((left, right) => left.timeMs - right.timeMs || left.id.localeCompare(right.id)),
  };
}

export function addTimelineEditorTrack<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  track: Omit<TimelineEditorTrack<TTrackData, TItemData>, "items"> &
    Partial<Pick<TimelineEditorTrack<TTrackData, TItemData>, "items">>,
  options: TimelineEditorOperationOptions = {},
) {
  if (document.tracks.some((candidate) => candidate.id === track.id)) {
    return document;
  }

  return normalizeTimelineEditorDocument(
    {
      ...document,
      tracks: [...document.tracks, { ...track, items: track.items ?? [] }],
    },
    options,
  );
}

export function removeTimelineEditorTrack<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  trackId: string,
  options: TimelineEditorOperationOptions = {},
) {
  if (!document.tracks.some((track) => track.id === trackId)) {
    return document;
  }

  const removedItemIds = new Set(
    document.tracks.find((track) => track.id === trackId)?.items.map((item) => item.id) ?? [],
  );

  return normalizeTimelineEditorDocument(
    {
      ...document,
      tracks: document.tracks.filter((track) => track.id !== trackId),
      groups: document.groups
        ?.map((group) => ({
          ...group,
          trackIds: group.trackIds.filter((candidate) => candidate !== trackId),
        }))
        .filter((group) => group.trackIds.length > 0),
      itemGroups: document.itemGroups
        ?.map((group) => ({
          ...group,
          itemIds: group.itemIds.filter((itemId) => !removedItemIds.has(itemId)),
        }))
        .filter((group) => group.itemIds.length > 1),
    },
    options,
  );
}

export function groupTimelineEditorItems<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  itemIds: readonly string[],
  group: Partial<TimelineEditorItemGroup> = {},
  options: TimelineEditorOperationOptions = {},
) {
  const groupableIds = new Set(
    document.tracks
      .flatMap((track) => (track.locked ? [] : track.items))
      .filter((item) => itemIds.includes(item.id) && !item.locked)
      .map((item) => item.id),
  );

  if (groupableIds.size < 2) {
    return document;
  }

  const existingIds = new Set(document.itemGroups?.map((candidate) => candidate.id));
  const itemGroupId =
    group.id && !existingIds.has(group.id)
      ? group.id
      : createTimelineEditorItemGroupId(document, group.id ?? "item-group");
  const nextItemGroup = {
    id: itemGroupId,
    label: group.label ?? `Group ${(document.itemGroups?.length ?? 0) + 1}`,
    itemIds: [...groupableIds],
    data: group.data,
  } satisfies TimelineEditorItemGroup;
  const replacedGroupIds = new Set(
    document.tracks
      .flatMap((track) => track.items)
      .filter((item) => groupableIds.has(item.id) && item.itemGroupId)
      .map((item) => item.itemGroupId!),
  );

  return normalizeTimelineEditorDocument(
    {
      ...document,
      tracks: document.tracks.map((track) => ({
        ...track,
        items: track.items.map((item) =>
          groupableIds.has(item.id) ? { ...item, itemGroupId } : item,
        ),
      })),
      itemGroups: [
        ...(document.itemGroups ?? []).filter((candidate) => !replacedGroupIds.has(candidate.id)),
        nextItemGroup,
      ],
    },
    options,
  );
}

export function ungroupTimelineEditorItems<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  itemIds: readonly string[],
  options: TimelineEditorOperationOptions = {},
) {
  const selectedIds = new Set(itemIds);
  const itemGroupIds = new Set(
    document.tracks
      .flatMap((track) => track.items)
      .filter((item) => selectedIds.has(item.id) && item.itemGroupId)
      .map((item) => item.itemGroupId!),
  );

  if (itemGroupIds.size === 0) {
    return document;
  }

  return normalizeTimelineEditorDocument(
    {
      ...document,
      tracks: document.tracks.map((track) => ({
        ...track,
        items: track.items.map((item) =>
          item.itemGroupId && itemGroupIds.has(item.itemGroupId)
            ? { ...item, itemGroupId: undefined }
            : item,
        ),
      })),
      itemGroups: document.itemGroups?.filter((group) => !itemGroupIds.has(group.id)),
    },
    options,
  );
}

export function getTimelineEditorGroupedItemIds<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>, itemIds: readonly string[]) {
  const selectedIds = new Set(itemIds);
  const itemGroupIds = new Set(
    document.tracks
      .flatMap((track) => track.items)
      .filter((item) => selectedIds.has(item.id) && item.itemGroupId)
      .map((item) => item.itemGroupId!),
  );

  if (itemGroupIds.size === 0) {
    return [...selectedIds];
  }

  for (const item of document.tracks.flatMap((track) => track.items)) {
    if (item.itemGroupId && itemGroupIds.has(item.itemGroupId)) {
      selectedIds.add(item.id);
    }
  }

  return [...selectedIds];
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
    itemGroupId: undefined,
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

function normalizeTimelineEditorTrack<TTrackData, TItemData>(
  track: TimelineEditorTrack<TTrackData, TItemData>,
  options: TimelineEditorOperationOptions = {},
): TimelineEditorTrack<TTrackData, TItemData> {
  const durationMs = options.durationMs ?? Number.POSITIVE_INFINITY;
  const minItemDurationMs = options.minItemDurationMs ?? defaultTimelineEditorMinItemDurationMs;

  return {
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
  };
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

function normalizeTimelineEditorItemGroups<TTrackData, TItemData>(
  itemGroups: TimelineEditorItemGroup[],
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
) {
  const itemIdsByGroupId = new Map<string, string[]>();

  for (const item of tracks.flatMap((track) => track.items)) {
    if (!item.itemGroupId) {
      continue;
    }

    itemIdsByGroupId.set(item.itemGroupId, [
      ...(itemIdsByGroupId.get(item.itemGroupId) ?? []),
      item.id,
    ]);
  }

  const knownGroupsById = new Map(itemGroups.map((group) => [group.id, group]));
  const normalizedGroups = [...itemIdsByGroupId.entries()]
    .filter(([, itemIds]) => itemIds.length > 1)
    .map(([itemGroupId, itemIds]) => {
      const group = knownGroupsById.get(itemGroupId);

      return {
        id: itemGroupId,
        label: group?.label ?? itemGroupId,
        itemIds,
        data: group?.data,
      } satisfies TimelineEditorItemGroup;
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  return normalizedGroups.length > 0 ? normalizedGroups : undefined;
}

function createTimelineEditorItemGroupId(
  document: TimelineEditorDocument<unknown, unknown, unknown>,
  baseId: string,
) {
  const existingIds = new Set(document.itemGroups?.map((group) => group.id));
  let candidate = baseId;
  let index = 2;

  while (existingIds.has(candidate)) {
    candidate = `${baseId}-${index}`;
    index += 1;
  }

  return candidate;
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
