import { clampTimelineEditorTime } from "../time";
import { normalizeTimelineEditorTransform } from "../transform";
import {
  defaultTimelineEditorMinItemDurationMs,
  type TimelineEditorDocument,
  type TimelineEditorItemGroup,
  type TimelineEditorOperationOptions,
  type TimelineEditorTrack,
} from "../types";

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

export function normalizeTimelineEditorTrack<TTrackData, TItemData>(
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
          ...(item.transform
            ? { transform: normalizeTimelineEditorTransform(item.transform, durationMsForItem) }
            : {}),
        };
      })
      .sort((left, right) => left.startMs - right.startMs || left.id.localeCompare(right.id)),
  };
}

export function normalizeTimelineEditorItemGroups<TTrackData, TItemData>(
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
