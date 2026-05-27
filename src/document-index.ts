import type { TimelineEditorDocument, TimelineEditorItem, TimelineEditorTrack } from "./types";

export type TimelineEditorDocumentIndex<TTrackData, TItemData> = {
  itemById: Map<string, TimelineEditorItem<TItemData>>;
  trackById: Map<string, TimelineEditorTrack<TTrackData, TItemData>>;
  trackIndexById: Map<string, number>;
  trackByItemId: Map<string, TimelineEditorTrack<TTrackData, TItemData>>;
  itemIdsByGroupId: Map<string, string[]>;
};

export function createTimelineEditorDocumentIndex<TTrackData, TItemData>(
  document: TimelineEditorDocument<TTrackData, TItemData, unknown>,
): TimelineEditorDocumentIndex<TTrackData, TItemData> {
  const itemById = new Map<string, TimelineEditorItem<TItemData>>();
  const trackById = new Map<string, TimelineEditorTrack<TTrackData, TItemData>>();
  const trackIndexById = new Map<string, number>();
  const trackByItemId = new Map<string, TimelineEditorTrack<TTrackData, TItemData>>();
  const itemIdsByGroupId = new Map<string, string[]>();

  document.tracks.forEach((track, trackIndex) => {
    trackById.set(track.id, track);
    trackIndexById.set(track.id, trackIndex);

    for (const item of track.items) {
      itemById.set(item.id, item);
      trackByItemId.set(item.id, track);

      if (item.itemGroupId) {
        const itemIds = itemIdsByGroupId.get(item.itemGroupId);

        if (itemIds) {
          itemIds.push(item.id);
        } else {
          itemIdsByGroupId.set(item.itemGroupId, [item.id]);
        }
      }
    }
  });

  return {
    itemById,
    trackById,
    trackIndexById,
    trackByItemId,
    itemIdsByGroupId,
  };
}

export function getTimelineEditorGroupedItemIdsFromIndex<TTrackData, TItemData>(
  index: TimelineEditorDocumentIndex<TTrackData, TItemData>,
  itemIds: readonly string[],
) {
  const selectedIds = new Set(itemIds);
  const itemGroupIds = new Set<string>();

  for (const itemId of itemIds) {
    const item = index.itemById.get(itemId);

    if (item?.itemGroupId) {
      itemGroupIds.add(item.itemGroupId);
    }
  }

  for (const itemGroupId of itemGroupIds) {
    for (const groupedItemId of index.itemIdsByGroupId.get(itemGroupId) ?? []) {
      selectedIds.add(groupedItemId);
    }
  }

  return [...selectedIds];
}
