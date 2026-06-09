import {
  type TimelineEditorDocument,
  type TimelineEditorSelection,
  type TimelineEditorTimeRange,
  type TimelineEditorTrack,
} from "../../core";

export function isTimelineWorkbenchCurrentTimeOnlyChange<TTrackData, TItemData>(
  document: TimelineEditorDocument<TTrackData, TItemData>,
  nextDocument: TimelineEditorDocument<TTrackData, TItemData>,
) {
  return (
    nextDocument.tracks === document.tracks &&
    nextDocument.groups === document.groups &&
    nextDocument.itemGroups === document.itemGroups &&
    nextDocument.durationMs === document.durationMs &&
    nextDocument.markers === document.markers &&
    nextDocument.currentTimeMs !== document.currentTimeMs
  );
}

export function selectionForItemIds(itemIds: string[]): TimelineEditorSelection {
  return { itemIds, anchorItemId: itemIds[0] };
}

export function normalizeTimelineWorkbenchRange(range: TimelineEditorTimeRange | undefined) {
  if (!range) {
    return undefined;
  }

  const startMs = Math.max(0, Math.min(range.startMs, range.endMs));
  const endMs = Math.max(startMs, Math.max(range.startMs, range.endMs));

  return startMs === endMs ? undefined : { startMs, endMs };
}

export function isTimelineWorkbenchTrackLocked<TTrackData, TItemData>(
  document: TimelineEditorDocument<TTrackData, TItemData>,
  track: TimelineEditorTrack<TTrackData, TItemData>,
) {
  return Boolean(
    track.locked ||
    document.groups?.some((group) => group.locked && group.trackIds.includes(track.id)),
  );
}
