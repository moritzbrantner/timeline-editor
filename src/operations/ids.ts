import type { TimelineEditorDocument, TimelineEditorTrack } from "../types";

export function createTimelineEditorItemGroupId(
  document: TimelineEditorDocument<unknown, unknown, unknown>,
  baseId: string,
) {
  const existingIds = new Set(document.itemGroups?.map((group) => group.id));
  let candidate = baseId;
  let index = 2;

  while (existingIds.has(candidate)) {
    candidate = `${baseId}-${index}`;
    index += 1;
  }

  return candidate;
}

export function createTimelineEditorCopyId<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>, baseId: string) {
  const existingIds = new Set(tracks.flatMap((track) => track.items.map((item) => item.id)));
  let candidate = baseId;
  let index = 2;

  while (existingIds.has(candidate)) {
    candidate = `${baseId}-${index}`;
    index += 1;
  }

  return candidate;
}
