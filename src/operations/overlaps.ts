import { getTimelineEditorItemEndMs } from "../time";
import type { TimelineEditorOverlap, TimelineEditorTrack } from "../types";

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
