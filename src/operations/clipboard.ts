import { clampTimelineEditorTime, getTimelineEditorItemEndMs } from "../time";
import type {
  TimelineEditorClipboard,
  TimelineEditorOperationOptions,
  TimelineEditorTrack,
} from "../types";
import { canPlaceTimelineEditorItemOnTrack, findTimelineEditorItem } from "./find";
import { normalizeTimelineEditorTracks } from "./normalize";
import { enforceOverlapPolicy } from "./overlap-policy";

export function createTimelineEditorClipboard<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  itemIds: readonly string[],
): TimelineEditorClipboard<TItemData> | undefined {
  const selectedIds = new Set(itemIds);
  const items = tracks
    .flatMap((track) =>
      track.items.filter((item) => selectedIds.has(item.id) && !item.locked && !track.locked),
    )
    .sort((left, right) => left.startMs - right.startMs || left.id.localeCompare(right.id));

  if (items.length === 0) {
    return undefined;
  }

  const sourceAnchorTrackIndex = tracks.findIndex((track) => track.id === items[0]!.trackId);
  const selectedTrackIds = new Set(items.map((item) => item.trackId));
  const sourceTrackOffsets = tracks.flatMap((track, trackIndex) =>
    selectedTrackIds.has(track.id)
      ? [{ trackId: track.id, offset: trackIndex - sourceAnchorTrackIndex }]
      : [],
  );

  return {
    items: items.map((item) => ({ ...item })),
    sourceStartMs: Math.min(...items.map((item) => item.startMs)),
    sourceTrackOffsets,
  };
}

export function pasteTimelineEditorClipboard<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  clipboard: TimelineEditorClipboard<TItemData>,
  input: {
    timeMs: number;
    trackId?: string;
    createId?: (itemId: string, existingIds: ReadonlySet<string>) => string;
  },
  options: TimelineEditorOperationOptions = {},
) {
  if (clipboard.items.length === 0) {
    return { tracks, itemIds: [] as string[] };
  }

  const durationMs = options.durationMs ?? Number.POSITIVE_INFINITY;
  const sourceEndMs = Math.max(...clipboard.items.map(getTimelineEditorItemEndMs));
  const selectionDurationMs = sourceEndMs - clipboard.sourceStartMs;

  if (Number.isFinite(durationMs) && selectionDurationMs > durationMs) {
    return { tracks, itemIds: [] as string[] };
  }

  const maxStartMs = Number.isFinite(durationMs)
    ? Math.max(0, durationMs - selectionDurationMs)
    : Number.POSITIVE_INFINITY;
  const targetStartMs = clampTimelineEditorTime(input.timeMs, 0, maxStartMs);
  const firstSourceTrackId = clipboard.items[0]?.trackId;
  const legacySourceAnchorTrackIndex = firstSourceTrackId
    ? tracks.findIndex((track) => track.id === firstSourceTrackId)
    : -1;
  const sourceTrackOffsets = new Map<string, number>(
    clipboard.sourceTrackOffsets?.map(({ trackId, offset }) => [trackId, offset] as const),
  );
  const targetAnchorTrackIndex = input.trackId
    ? tracks.findIndex((track) => track.id === input.trackId)
    : -1;

  if (input.trackId && targetAnchorTrackIndex < 0) {
    return { tracks, itemIds: [] as string[] };
  }

  const existingIds = new Set(tracks.flatMap((track) => track.items.map((item) => item.id)));
  const plannedItems: Array<{
    item: TimelineEditorTrack<TTrackData, TItemData>["items"][number];
    targetTrackId: string;
  }> = [];

  for (const item of clipboard.items) {
    const sourceTrackOffset =
      sourceTrackOffsets.get(item.trackId) ??
      getLegacySourceTrackOffset(tracks, item.trackId, legacySourceAnchorTrackIndex);
    const targetTrack = resolvePasteTargetTrack(
      tracks,
      item,
      sourceTrackOffset,
      targetAnchorTrackIndex,
      input.trackId,
    );

    if (!targetTrack || !canPlaceTimelineEditorItemOnTrack(item, targetTrack)) {
      return { tracks, itemIds: [] as string[] };
    }

    const requestedId = input.createId?.(item.id, existingIds);
    const id = createUniqueCopyId(existingIds, requestedId ?? `${item.id}-copy`);
    existingIds.add(id);
    plannedItems.push({
      targetTrackId: targetTrack.id,
      item: {
        ...item,
        id,
        trackId: targetTrack.id,
        itemGroupId: undefined,
        startMs: targetStartMs + (item.startMs - clipboard.sourceStartMs),
      },
    });
  }

  const plannedItemsByTrackId = new Map<
    string,
    Array<TimelineEditorTrack<TTrackData, TItemData>["items"][number]>
  >();

  for (const planned of plannedItems) {
    const items = plannedItemsByTrackId.get(planned.targetTrackId);

    if (items) {
      items.push(planned.item);
    } else {
      plannedItemsByTrackId.set(planned.targetTrackId, [planned.item]);
    }
  }

  const nextTracks = normalizeTimelineEditorTracks(
    tracks.map((track) => {
      const pastedItems = plannedItemsByTrackId.get(track.id);
      return pastedItems ? { ...track, items: [...track.items, ...pastedItems] } : track;
    }),
    options,
  );
  const acceptedTracks = enforceOverlapPolicy(nextTracks, tracks, options);

  return acceptedTracks === tracks
    ? { tracks, itemIds: [] as string[] }
    : { tracks: acceptedTracks, itemIds: plannedItems.map(({ item }) => item.id) };
}

export function duplicateTimelineEditorItems<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  itemIds: readonly string[],
  options: TimelineEditorOperationOptions = {},
) {
  const uniqueItemIds = [...new Set(itemIds)];

  if (uniqueItemIds.length === 0) {
    return tracks;
  }

  for (const itemId of uniqueItemIds) {
    const found = findTimelineEditorItem(tracks, itemId);

    if (!found || found.item.locked || found.track.locked) {
      return tracks;
    }
  }

  const clipboard = createTimelineEditorClipboard(tracks, uniqueItemIds);

  if (!clipboard) {
    return tracks;
  }

  const sourceEndMs = Math.max(...clipboard.items.map(getTimelineEditorItemEndMs));
  return pasteTimelineEditorClipboard(tracks, clipboard, { timeMs: sourceEndMs }, options).tracks;
}

function getLegacySourceTrackOffset<TTrackData, TItemData>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  sourceTrackId: string,
  sourceAnchorTrackIndex: number,
) {
  if (sourceAnchorTrackIndex < 0) {
    return undefined;
  }

  const sourceTrackIndex = tracks.findIndex((track) => track.id === sourceTrackId);
  return sourceTrackIndex < 0 ? undefined : sourceTrackIndex - sourceAnchorTrackIndex;
}

function resolvePasteTargetTrack<TTrackData, TItemData>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  item: TimelineEditorTrack<TTrackData, TItemData>["items"][number],
  sourceTrackOffset: number | undefined,
  targetAnchorTrackIndex: number,
  requestedTrackId: string | undefined,
) {
  if (requestedTrackId) {
    if (sourceTrackOffset === undefined) {
      return undefined;
    }

    return tracks[targetAnchorTrackIndex + sourceTrackOffset];
  }

  const originalTrack = tracks.find((track) => track.id === item.trackId);

  if (originalTrack) {
    return originalTrack;
  }

  return tracks.find((track) => canPlaceTimelineEditorItemOnTrack(item, track));
}

function createUniqueCopyId(existingIds: ReadonlySet<string>, baseId: string) {
  let candidate = baseId;
  let index = 2;

  while (existingIds.has(candidate)) {
    candidate = `${baseId}-${index}`;
    index += 1;
  }

  return candidate;
}
