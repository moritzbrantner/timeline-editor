import type {
  TimelineEditorDocument,
  TimelineEditorItem,
  TimelineEditorSelection,
  TimelineEditorTrack,
} from "../../core";

export type TimelineTrackForSelection<TItemData> =
  | TimelineEditorTrack<Record<string, unknown>, TItemData>
  | undefined;

export function createTimelineWorkbenchItemLookup<TTrackData, TItemData>(
  document: TimelineEditorDocument<TTrackData, TItemData>,
) {
  const lookup = new Map<
    string,
    {
      item: TimelineEditorItem<TItemData>;
      track: TimelineEditorTrack<TTrackData, TItemData>;
    }
  >();

  for (const track of document.tracks) {
    for (const item of track.items) {
      lookup.set(item.id, { item, track });
    }
  }

  return lookup;
}

export function getTimelineWorkbenchSelectedItems<TTrackData, TItemData>(
  selection: TimelineEditorSelection,
  itemLookup: ReturnType<typeof createTimelineWorkbenchItemLookup<TTrackData, TItemData>>,
) {
  return selection.itemIds
    .map((itemId) => itemLookup.get(itemId)?.item)
    .filter((item): item is TimelineEditorItem<TItemData> => Boolean(item));
}

export function getTimelineWorkbenchSelectionPayload<TTrackData, TItemData>(
  selection: TimelineEditorSelection,
  itemLookup: ReturnType<typeof createTimelineWorkbenchItemLookup<TTrackData, TItemData>>,
) {
  const nextSelected = selection.itemIds[0] ? itemLookup.get(selection.itemIds[0]) : undefined;

  return {
    item: nextSelected?.item,
    itemId: selection.itemIds[0],
    itemIds: selection.itemIds,
    track: nextSelected?.track as TimelineTrackForSelection<TItemData>,
  };
}
