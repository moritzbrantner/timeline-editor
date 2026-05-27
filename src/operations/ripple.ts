import { getTimelineEditorItemEndMs } from "../time";
import type {
  TimelineEditorItem,
  TimelineEditorOperationOptions,
  TimelineEditorTrack,
} from "../types";
import { normalizeTimelineEditorTracks } from "./normalize";

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
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  itemIds: readonly string[],
  options: TimelineEditorOperationOptions = {},
) {
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
    options,
  );
}

function updateItemStart<TItemData>(item: TimelineEditorItem<TItemData>, startMs: number) {
  return { ...item, startMs };
}
