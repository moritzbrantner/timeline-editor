import type { TimelineEditorDocument, TimelineEditorItem, TimelineEditorTrack } from "../../types";
import type { TimelineEditorDocumentIndex } from "../../document-index";

export function getSelectedTimelineEditorItems<TTrackData, TItemData>(
  document: TimelineEditorDocument<TTrackData, TItemData>,
  selectedIds: ReadonlySet<string>,
  index?: TimelineEditorDocumentIndex<TTrackData, TItemData>,
) {
  if (index) {
    const items: Array<TimelineEditorItem<TItemData>> = [];

    for (const itemId of selectedIds) {
      const item = index.itemById.get(itemId);

      if (item) {
        items.push(item);
      }
    }

    return items;
  }

  return document.tracks.flatMap((track) => track.items.filter((item) => selectedIds.has(item.id)));
}

export function getRangeSelectionIds<TTrackData, TItemData>(
  track: TimelineEditorTrack<TTrackData, TItemData>,
  anchorItemId: string,
  itemId: string,
) {
  let anchorIndex = -1;
  let itemIndex = -1;
  let sorted = true;

  for (let index = 0; index < track.items.length; index += 1) {
    const item = track.items[index]!;
    const previousItem = track.items[index - 1];

    if (
      Number.isNaN(item.startMs) ||
      (previousItem &&
        (item.startMs < previousItem.startMs ||
          (item.startMs === previousItem.startMs && item.id.localeCompare(previousItem.id) < 0)))
    ) {
      sorted = false;
    }
    if (item.id === anchorItemId) {
      anchorIndex = index;
    }
    if (item.id === itemId) {
      itemIndex = index;
    }
  }

  const items = sorted
    ? track.items
    : [...track.items].sort(
        (left, right) => left.startMs - right.startMs || left.id.localeCompare(right.id),
      );

  if (!sorted) {
    anchorIndex = items.findIndex((item) => item.id === anchorItemId);
    itemIndex = items.findIndex((item) => item.id === itemId);
  }

  if (anchorIndex === -1 || itemIndex === -1) {
    return [itemId];
  }

  const [startIndex, endIndex] =
    anchorIndex < itemIndex ? [anchorIndex, itemIndex] : [itemIndex, anchorIndex];

  return items.slice(startIndex, endIndex + 1).map((item) => item.id);
}

export function getVisibleTracks<TTrackData, TItemData>(
  document: TimelineEditorDocument<TTrackData, TItemData>,
  index?: TimelineEditorDocumentIndex<TTrackData, TItemData>,
) {
  const groupedTrackIds = new Set(document.groups?.flatMap((group) => group.trackIds));
  const entries: Array<
    | { type: "group"; group: NonNullable<typeof document.groups>[number] }
    | {
        type: "track";
        track: TimelineEditorTrack<TTrackData, TItemData>;
        locked: boolean;
      }
  > = [];

  for (const group of document.groups ?? []) {
    entries.push({ type: "group", group });

    if (group.collapsed) {
      continue;
    }

    for (const trackId of group.trackIds) {
      const track = index
        ? index.trackById.get(trackId)
        : document.tracks.find((candidate) => candidate.id === trackId);
      if (track) {
        entries.push({ type: "track", track, locked: Boolean(group.locked || track.locked) });
      }
    }
  }

  for (const track of document.tracks) {
    if (!groupedTrackIds.has(track.id)) {
      entries.push({ type: "track", track, locked: Boolean(track.locked) });
    }
  }

  return entries;
}

export function isTrackLockedByGroup<TTrackData, TItemData>(
  document: TimelineEditorDocument<TTrackData, TItemData>,
  track: TimelineEditorTrack<TTrackData, TItemData>,
) {
  return Boolean(
    track.locked ||
    document.groups?.some((group) => group.locked && group.trackIds.includes(track.id)),
  );
}
