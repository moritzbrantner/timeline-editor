import type {
  TimelineEditorClip as UiTimelineEditorClip,
  TimelineEditorMarker as UiTimelineEditorMarker,
  TimelineEditorTrack as UiTimelineEditorTrack,
} from "@moritzbrantner/ui/labs";

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

export type TimelineEditorMarker = {
  id: string;
  timeMs: number;
  label?: string;
  color?: string;
};

export type TimelineEditorDocument<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = {
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>;
  durationMs?: number;
  currentTimeMs?: number;
  markers?: TimelineEditorMarker[];
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

export type TimelineEditorOperationOptions = {
  durationMs?: number;
  minItemDurationMs?: number;
  snapMs?: number;
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

export const defaultTimelineEditorMinItemDurationMs = 100;

export function clampTimelineEditorTime(
  timeMs: number,
  minMs = 0,
  maxMs = Number.POSITIVE_INFINITY,
) {
  if (Number.isNaN(timeMs) || timeMs === Number.NEGATIVE_INFINITY) {
    return minMs;
  }

  if (timeMs === Number.POSITIVE_INFINITY) {
    return Number.isFinite(maxMs) ? maxMs : minMs;
  }

  return Math.min(Math.max(timeMs, minMs), maxMs);
}

export function snapTimelineEditorTime(timeMs: number, snapMs = 0) {
  if (!Number.isFinite(timeMs) || snapMs <= 0) {
    return timeMs;
  }

  return Math.round(timeMs / snapMs) * snapMs;
}

export function getTimelineEditorItemEndMs(
  item: Pick<TimelineEditorItem, "durationMs" | "startMs">,
) {
  return item.startMs + item.durationMs;
}

export function formatTimelineEditorTimeMs(timeMs: number) {
  const safeTimeMs = Math.max(0, Math.round(timeMs));
  const totalSeconds = Math.floor(safeTimeMs / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((safeTimeMs % 1_000) / 100);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

export function getTimelineEditorDurationMs<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>, fallbackMs = 60_000) {
  const itemEndMs = tracks.flatMap((track) => track.items.map(getTimelineEditorItemEndMs));
  return Math.max(fallbackMs, 1, ...itemEndMs);
}

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
  const snapMs = options.snapMs ?? 0;
  const maxStartMs = Math.max(0, durationMs - found.item.durationMs);
  const nextStartMs = clampTimelineEditorTime(
    snapTimelineEditorTime(input.startMs ?? found.item.startMs, snapMs),
    0,
    maxStartMs,
  );

  return normalizeTimelineEditorTracks(
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
  const snapMs = options.snapMs ?? 0;
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

  return normalizeTimelineEditorTracks(
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
    snapTimelineEditorTime(input.timeMs, options.snapMs ?? 0),
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

export function toUiTimelineEditorTracks<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>): UiTimelineEditorTrack[] {
  return tracks.map((track) => ({
    id: track.id,
    label: track.label,
    locked: track.locked,
    height: track.height,
    clips: track.items.map((item) => toUiTimelineEditorClip(item)),
  }));
}

export function fromUiTimelineEditorTracks<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  uiTracks: UiTimelineEditorTrack[],
  previousTracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
): Array<TimelineEditorTrack<TTrackData, TItemData>> {
  const previousTrackLookup = new Map(previousTracks.map((track) => [track.id, track]));
  const previousItemLookup = new Map(
    previousTracks.flatMap((track) => track.items.map((item) => [item.id, item] as const)),
  );

  return uiTracks.map((track) => {
    const previousTrack = previousTrackLookup.get(track.id);

    return {
      id: track.id,
      label: track.label,
      acceptsItemKinds: previousTrack?.acceptsItemKinds,
      height: track.height,
      locked: track.locked,
      data: previousTrack?.data,
      items: track.clips.map((clip) => {
        const previousItem = previousItemLookup.get(clip.id);

        return {
          id: clip.id,
          trackId: track.id,
          label: clip.label,
          startMs: Math.round(clip.start * 1_000),
          durationMs: Math.max(0, Math.round((clip.end - clip.start) * 1_000)),
          kind: previousItem?.kind,
          color: clip.color ?? previousItem?.color,
          locked: clip.disabled ?? previousItem?.locked,
          data: (clip.metadata as TItemData | undefined) ?? previousItem?.data,
        };
      }),
    };
  });
}

export function toUiTimelineEditorMarkers(markers: readonly TimelineEditorMarker[] = []) {
  return markers.map(
    (marker): UiTimelineEditorMarker => ({
      id: marker.id,
      time: marker.timeMs / 1_000,
      label: marker.label,
      color: marker.color,
    }),
  );
}

function toUiTimelineEditorClip<TData>(item: TimelineEditorItem<TData>): UiTimelineEditorClip {
  return {
    id: item.id,
    label: item.label,
    start: item.startMs / 1_000,
    end: getTimelineEditorItemEndMs(item) / 1_000,
    color: item.color,
    disabled: item.locked,
    metadata: item.data as Record<string, unknown> | undefined,
  };
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
