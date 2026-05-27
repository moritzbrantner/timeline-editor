import type {
  TimelineEditorOperationOptions,
  TimelineEditorTrack,
  TimelineEditorTransform,
  TimelineEditorTransformValues,
} from "../types";
import { findTimelineEditorItem } from "./find";
import { normalizeTimelineEditorTracks } from "./normalize";

export function setTimelineEditorItemTransform<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TTransformValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData, TTransformValues>>,
  itemId: string,
  transform: TimelineEditorTransform<TTransformValues> | undefined,
  options: TimelineEditorOperationOptions = {},
) {
  const found = findTimelineEditorItem(tracks, itemId);

  if (!found || found.item.locked || found.track.locked) {
    return tracks;
  }

  return normalizeTimelineEditorTracks(
    tracks.map((track) =>
      track.id === found.track.id
        ? {
            ...track,
            items: track.items.map((item) => (item.id === itemId ? { ...item, transform } : item)),
          }
        : track,
    ),
    options,
  );
}
