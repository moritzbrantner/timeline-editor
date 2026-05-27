import type {
  TimelineEditorDocument,
  TimelineEditorItemGroup,
  TimelineEditorOperationOptions,
} from "../types";
import {
  createTimelineEditorDocumentIndex,
  getTimelineEditorGroupedItemIdsFromIndex,
} from "../document-index";
import { createTimelineEditorItemGroupId } from "./ids";
import { normalizeTimelineEditorDocument } from "./normalize";

export function groupTimelineEditorItems<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  itemIds: readonly string[],
  group: Partial<TimelineEditorItemGroup> = {},
  options: TimelineEditorOperationOptions = {},
) {
  const groupableIds = new Set(
    document.tracks
      .flatMap((track) => (track.locked ? [] : track.items))
      .filter((item) => itemIds.includes(item.id) && !item.locked)
      .map((item) => item.id),
  );

  if (groupableIds.size < 2) {
    return document;
  }

  const existingIds = new Set(document.itemGroups?.map((candidate) => candidate.id));
  const itemGroupId =
    group.id && !existingIds.has(group.id)
      ? group.id
      : createTimelineEditorItemGroupId(document, group.id ?? "item-group");
  const nextItemGroup = {
    id: itemGroupId,
    label: group.label ?? `Group ${(document.itemGroups?.length ?? 0) + 1}`,
    itemIds: [...groupableIds],
    data: group.data,
  } satisfies TimelineEditorItemGroup;
  const replacedGroupIds = new Set(
    document.tracks
      .flatMap((track) => track.items)
      .filter((item) => groupableIds.has(item.id) && item.itemGroupId)
      .map((item) => item.itemGroupId!),
  );

  return normalizeTimelineEditorDocument(
    {
      ...document,
      tracks: document.tracks.map((track) => ({
        ...track,
        items: track.items.map((item) =>
          groupableIds.has(item.id) ? { ...item, itemGroupId } : item,
        ),
      })),
      itemGroups: [
        ...(document.itemGroups ?? []).filter((candidate) => !replacedGroupIds.has(candidate.id)),
        nextItemGroup,
      ],
    },
    options,
  );
}

export function ungroupTimelineEditorItems<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  itemIds: readonly string[],
  options: TimelineEditorOperationOptions = {},
) {
  const selectedIds = new Set(itemIds);
  const itemGroupIds = new Set(
    document.tracks
      .flatMap((track) => track.items)
      .filter((item) => selectedIds.has(item.id) && item.itemGroupId)
      .map((item) => item.itemGroupId!),
  );

  if (itemGroupIds.size === 0) {
    return document;
  }

  return normalizeTimelineEditorDocument(
    {
      ...document,
      tracks: document.tracks.map((track) => ({
        ...track,
        items: track.items.map((item) =>
          item.itemGroupId && itemGroupIds.has(item.itemGroupId)
            ? { ...item, itemGroupId: undefined }
            : item,
        ),
      })),
      itemGroups: document.itemGroups?.filter((group) => !itemGroupIds.has(group.id)),
    },
    options,
  );
}

export function getTimelineEditorGroupedItemIds<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>, itemIds: readonly string[]) {
  return getTimelineEditorGroupedItemIdsFromIndex(
    createTimelineEditorDocumentIndex(document),
    itemIds,
  );
}
