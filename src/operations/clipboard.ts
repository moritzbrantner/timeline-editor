import { clampTimelineEditorTime, getTimelineEditorItemEndMs } from "../time";
import type {
  TimelineEditorClipboard,
  TimelineEditorOperationOptions,
  TimelineEditorTrack,
} from "../types";
import { canPlaceTimelineEditorItemOnTrack, findTimelineEditorItem } from "./find";
import { createTimelineEditorClipboard } from "./items";
import { normalizeTimelineEditorTracks } from "./normalize";
import { enforceOverlapPolicy } from "./overlap-policy";

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
  const sourceTrackIndices = new Map<string, number>();

  for (const item of clipboard.items) {
    if (!sourceTrackIndices.has(item.trackId)) {
      sourceTrackIndices.set(
        item.trackId,
        tracks.findIndex((track) => track.id === item.trackId),
      );
    }
  }

  const knownSourceTrackIndices = [...sourceTrackIndices.values()].filter((index) => index >= 0);
  const sourceAnchorTrackIndex =
    knownSourceTrackIndices.length > 0 ? Math.min(...knownSourceTrackIndices) : -1;
  const targetAnchorTrackIndex = input.trackId
    ? tracks.findIndex((track) => track.id === input.trackId)
    : -1;

  if (input.trackId && (sourceAnchorTrackIndex < 0 || targetAnchorTrackIndex < 0)) {
    return { tracks, itemIds: [] as string[] };
  }

  const existingIds = new Set(tracks.flatMap((track) => track.items.map((item) => item.id)));
  const plannedItems: Array<{
    item: TimelineEditorTrack<TTrackData, TItemData>["items"][number];
    targetTrackId: string;
  }> = [];

  for (const item of clipboard.items) {
    const targetTrack = resolvePasteTargetTrack(
      tracks,
      item,
      sourceTrackIndices.get(item.trackId) ?? -1,
      sourceAnchorTrackIndex,
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

function resolvePasteTargetTrack<TTrackData, TItemData>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  item: TimelineEditorTrack<TTrackData, TItemData>["items"][number],
  sourceTrackIndex: number,
  sourceAnchorTrackIndex: number,
  targetAnchorTrackIndex: number,
  requestedTrackId: string | undefined,
) {
  if (requestedTrackId) {
    if (sourceTrackIndex < 0) {
      return undefined;
    }

    return tracks[targetAnchorTrackIndex + (sourceTrackIndex - sourceAnchorTrackIndex)];
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
