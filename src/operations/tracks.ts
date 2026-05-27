import type {
  TimelineEditorDocument,
  TimelineEditorOperationOptions,
  TimelineEditorTrack,
} from "../types";
import { normalizeTimelineEditorDocument } from "./normalize";

export function addTimelineEditorTrack<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  track: Omit<TimelineEditorTrack<TTrackData, TItemData>, "items"> &
    Partial<Pick<TimelineEditorTrack<TTrackData, TItemData>, "items">>,
  options: TimelineEditorOperationOptions = {},
) {
  if (document.tracks.some((candidate) => candidate.id === track.id)) {
    return document;
  }

  return normalizeTimelineEditorDocument(
    {
      ...document,
      tracks: [...document.tracks, { ...track, items: track.items ?? [] }],
    },
    options,
  );
}

export function removeTimelineEditorTrack<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  trackId: string,
  options: TimelineEditorOperationOptions = {},
) {
  if (!document.tracks.some((track) => track.id === trackId)) {
    return document;
  }

  const removedItemIds = new Set(
    document.tracks.find((track) => track.id === trackId)?.items.map((item) => item.id) ?? [],
  );

  return normalizeTimelineEditorDocument(
    {
      ...document,
      tracks: document.tracks.filter((track) => track.id !== trackId),
      groups: document.groups
        ?.map((group) => ({
          ...group,
          trackIds: group.trackIds.filter((candidate) => candidate !== trackId),
        }))
        .filter((group) => group.trackIds.length > 0),
      itemGroups: document.itemGroups
        ?.map((group) => ({
          ...group,
          itemIds: group.itemIds.filter((itemId) => !removedItemIds.has(itemId)),
        }))
        .filter((group) => group.itemIds.length > 1),
    },
    options,
  );
}
