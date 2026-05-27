import type {
  FoundTimelineEditorItem,
  TimelineEditorItem,
  TimelineEditorTrack,
  TimelineEditorTransformValues,
} from "../types";

export function findTimelineEditorItem<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TTransformValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData, TTransformValues>>,
  itemId: string,
): FoundTimelineEditorItem<TTrackData, TItemData, TTransformValues> | undefined {
  for (const track of tracks) {
    const item = track.items.find((candidate) => candidate.id === itemId);

    if (item) {
      return { item, track };
    }
  }

  return undefined;
}

export function canPlaceTimelineEditorItemOnTrack<
  TTrackData,
  TItemData,
  TTransformValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
>(
  item: TimelineEditorItem<TItemData, TTransformValues>,
  track: TimelineEditorTrack<TTrackData, TItemData, TTransformValues>,
) {
  if (track.locked) {
    return false;
  }

  return doesTimelineEditorTrackAcceptItem(item, track);
}

export function doesTimelineEditorTrackAcceptItem<
  TTrackData,
  TItemData,
  TTransformValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
>(
  item: TimelineEditorItem<TItemData, TTransformValues>,
  track: TimelineEditorTrack<TTrackData, TItemData, TTransformValues>,
) {
  if (track.kind) {
    return item.kind === track.kind;
  }

  if (!track.acceptsItemKinds || !item.kind) {
    return true;
  }

  return track.acceptsItemKinds.includes(item.kind);
}
