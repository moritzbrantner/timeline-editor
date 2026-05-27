import type { TimelineEditorDocument, TimelineEditorTrack } from "../../types";

export function getSelectedTimelineEditorItems<TTrackData, TItemData>(
  document: TimelineEditorDocument<TTrackData, TItemData>,
  selectedIds: ReadonlySet<string>,
) {
  return document.tracks.flatMap((track) => track.items.filter((item) => selectedIds.has(item.id)));
}

export function getRangeSelectionIds<TTrackData, TItemData>(
  track: TimelineEditorTrack<TTrackData, TItemData>,
  anchorItemId: string,
  itemId: string,
) {
  const sortedItems = [...track.items].sort(
    (left, right) => left.startMs - right.startMs || left.id.localeCompare(right.id),
  );
  const anchorIndex = sortedItems.findIndex((item) => item.id === anchorItemId);
  const itemIndex = sortedItems.findIndex((item) => item.id === itemId);

  if (anchorIndex === -1 || itemIndex === -1) {
    return [itemId];
  }

  const [startIndex, endIndex] =
    anchorIndex < itemIndex ? [anchorIndex, itemIndex] : [itemIndex, anchorIndex];

  return sortedItems.slice(startIndex, endIndex + 1).map((item) => item.id);
}

export function getVisibleTracks<TTrackData, TItemData>(
  document: TimelineEditorDocument<TTrackData, TItemData>,
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
      const track = document.tracks.find((candidate) => candidate.id === trackId);
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
