import {
  clampTimelineEditorTime,
  getTimelineEditorItemEndMs,
  snapTimelineEditorTime,
} from "../time";
import type { TimelineEditorOperationOptions, TimelineEditorTrack } from "../types";
import { canPlaceTimelineEditorItemOnTrack, findTimelineEditorItem } from "./find";
import { normalizeTimelineEditorTracks } from "./normalize";
import { enforceOverlapPolicy } from "./overlap-policy";
import { getSnapMs } from "./snap";

export function moveTimelineEditorItems<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  itemIds: readonly string[],
  deltaMs: number,
  options: TimelineEditorOperationOptions & { trackDelta?: number } = {},
) {
  const movingIds = [...new Set(itemIds)];

  if (movingIds.length === 0 || Number.isNaN(deltaMs)) {
    return tracks;
  }

  const movingItems = [] as Array<{
    item: TimelineEditorTrack<TTrackData, TItemData>["items"][number];
    trackIndex: number;
  }>;

  for (const itemId of movingIds) {
    const found = findTimelineEditorItem(tracks, itemId);

    if (!found || found.item.locked || found.track.locked) {
      return tracks;
    }

    const trackIndex = tracks.findIndex((track) => track.id === found.track.id);

    if (trackIndex < 0) {
      return tracks;
    }

    movingItems.push({ item: found.item, trackIndex });
  }

  const durationMs = options.durationMs ?? Number.POSITIVE_INFINITY;
  const anchor = movingItems.reduce((current, candidate) =>
    candidate.item.startMs < current.item.startMs ||
    (candidate.item.startMs === current.item.startMs && candidate.item.id < current.item.id)
      ? candidate
      : current,
  );
  const snappedAnchorStartMs = snapTimelineEditorTime(
    anchor.item.startMs + deltaMs,
    getSnapMs(options),
  );
  const requestedDeltaMs = snappedAnchorStartMs - anchor.item.startMs;
  const minDeltaMs = Math.max(...movingItems.map(({ item }) => -item.startMs));
  const maxDeltaMs = Math.min(
    ...movingItems.map(({ item }) => durationMs - getTimelineEditorItemEndMs(item)),
  );

  if (maxDeltaMs < minDeltaMs) {
    return tracks;
  }

  const resolvedDeltaMs = clampTimelineEditorTime(
    requestedDeltaMs,
    minDeltaMs,
    maxDeltaMs,
  );
  let resolvedTrackDelta = 0;

  if (options.trackDelta !== undefined) {
    if (Number.isNaN(options.trackDelta)) {
      return tracks;
    }

    const requestedTrackDelta = Math.trunc(options.trackDelta);
    const minTrackIndex = Math.min(...movingItems.map(({ trackIndex }) => trackIndex));
    const maxTrackIndex = Math.max(...movingItems.map(({ trackIndex }) => trackIndex));
    resolvedTrackDelta = clampTimelineEditorTime(
      requestedTrackDelta,
      -minTrackIndex,
      tracks.length - 1 - maxTrackIndex,
    );
  }

  if (resolvedDeltaMs === 0 && resolvedTrackDelta === 0) {
    return tracks;
  }

  const movedItemsByTrackId = new Map<
    string,
    Array<TimelineEditorTrack<TTrackData, TItemData>["items"][number]>
  >();

  for (const { item, trackIndex } of movingItems) {
    const targetTrack = tracks[trackIndex + resolvedTrackDelta];

    if (!targetTrack || !canPlaceTimelineEditorItemOnTrack(item, targetTrack)) {
      return tracks;
    }

    const movedItem = {
      ...item,
      trackId: targetTrack.id,
      startMs: item.startMs + resolvedDeltaMs,
    };
    const targetItems = movedItemsByTrackId.get(targetTrack.id);

    if (targetItems) {
      targetItems.push(movedItem);
    } else {
      movedItemsByTrackId.set(targetTrack.id, [movedItem]);
    }
  }

  const movingIdSet = new Set(movingIds);
  const nextTracks = normalizeTimelineEditorTracks(
    tracks.map((track) => {
      const movedItems = movedItemsByTrackId.get(track.id) ?? [];
      const retainedItems = track.items.filter((item) => !movingIdSet.has(item.id));

      if (movedItems.length === 0 && retainedItems.length === track.items.length) {
        return track;
      }

      return { ...track, items: [...retainedItems, ...movedItems] };
    }),
    options,
  );

  return enforceOverlapPolicy(nextTracks, tracks, options);
}
