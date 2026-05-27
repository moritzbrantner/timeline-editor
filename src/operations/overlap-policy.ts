import { getTimelineEditorItemEndMs } from "../time";
import {
  type TimelineEditorItem,
  type TimelineEditorOperationOptions,
  type TimelineEditorTrack,
} from "../types";

export function pushTimelineEditorOverlaps<TTrackData, TItemData>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  options: TimelineEditorOperationOptions,
) {
  const durationMs = options.durationMs ?? Number.POSITIVE_INFINITY;
  let changed = false;
  const nextTracks: Array<TimelineEditorTrack<TTrackData, TItemData>> = [];

  for (const track of tracks) {
    if (track.locked) {
      if (trackHasOverlap(track)) {
        return undefined;
      }

      nextTracks.push(track);
      continue;
    }

    let trackChanged = false;
    let nextStartMs = 0;
    const items: Array<TimelineEditorItem<TItemData>> = [];

    for (const item of track.items) {
      if (item.startMs < nextStartMs) {
        if (item.locked) {
          return undefined;
        }

        const itemEndMs = nextStartMs + item.durationMs;

        if (itemEndMs > durationMs) {
          return undefined;
        }

        items.push({ ...item, startMs: nextStartMs });
        trackChanged = true;
        changed = true;
        nextStartMs = itemEndMs;
        continue;
      }

      items.push(item);
      nextStartMs = getTimelineEditorItemEndMs(item);
    }

    nextTracks.push(trackChanged ? { ...track, items } : track);
  }

  return changed ? nextTracks : tracks;
}

function trackHasOverlap<TTrackData, TItemData>(track: TimelineEditorTrack<TTrackData, TItemData>) {
  for (let index = 1; index < track.items.length; index += 1) {
    const previousItem = track.items[index - 1]!;
    const item = track.items[index]!;

    if (getTimelineEditorItemEndMs(previousItem) > item.startMs) {
      return true;
    }
  }

  return false;
}
