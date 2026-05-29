import {
  type TimelineEditorDocument,
  type TimelineEditorItem,
  type TimelineEditorItemKind,
  type TimelineEditorSelection,
  type TimelineEditorTimeRange,
  type TimelineEditorTrack,
} from "../../core";
import { getTimelineMediaTypeForItem } from "../../media-types";
import type {
  TimelineEditorExtension,
  TimelineWorkbenchAsset,
  TimelineWorkbenchImportSource,
} from "./types";
import { formatTimelineWorkbenchTrackKind } from "./ids";

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

export function areTimelineWorkbenchSelectionsEqual(
  left: TimelineEditorSelection,
  right: TimelineEditorSelection,
) {
  if (
    left.anchorItemId !== right.anchorItemId ||
    left.itemIds.length !== right.itemIds.length ||
    (left.trackIds?.length ?? 0) !== (right.trackIds?.length ?? 0) ||
    (left.markerIds?.length ?? 0) !== (right.markerIds?.length ?? 0) ||
    left.range?.startMs !== right.range?.startMs ||
    left.range?.endMs !== right.range?.endMs
  ) {
    return false;
  }

  return (
    left.itemIds.every((itemId, index) => itemId === right.itemIds[index]) &&
    (left.trackIds ?? []).every((trackId, index) => trackId === right.trackIds?.[index]) &&
    (left.markerIds ?? []).every((markerId, index) => markerId === right.markerIds?.[index])
  );
}

export function normalizeTimelineWorkbenchRange(range: TimelineEditorTimeRange | undefined) {
  if (!range) {
    return undefined;
  }

  const startMs = Math.max(0, Math.min(range.startMs, range.endMs));
  const endMs = Math.max(startMs, Math.max(range.startMs, range.endMs));

  return startMs === endMs ? undefined : { startMs, endMs };
}

export function getTimelineWorkbenchItemRenderExtension<
  TTrackData extends Record<string, unknown>,
  TItemData,
  TAssetData,
>(
  item: TimelineEditorItem<TItemData>,
  extensions: Array<TimelineEditorExtension<TItemData, TTrackData, TAssetData>>,
) {
  const itemKind = item.kind;
  const itemKindExtension = itemKind
    ? extensions.find(
        (extension) => extension.renderItem && extension.itemKinds?.includes(itemKind),
      )
    : undefined;

  if (itemKindExtension) {
    return itemKindExtension;
  }

  const mediaType = getTimelineMediaTypeForItem(item);

  return mediaType
    ? extensions.find(
        (extension) => extension.renderItem && extension.mediaTypes?.includes(mediaType),
      )
    : undefined;
}

export function getTimelineWorkbenchTrackKinds<
  TTrackData extends Record<string, unknown>,
  TItemData,
  TAssetData,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  assets: Array<TimelineWorkbenchAsset<TAssetData>>,
  extensions: Array<TimelineEditorExtension<TItemData, TTrackData, TAssetData>>,
) {
  const kinds = new Set<TimelineEditorItemKind>();

  for (const track of tracks) {
    if (track.kind) {
      kinds.add(track.kind);
    }

    for (const kind of track.acceptsItemKinds ?? []) {
      kinds.add(kind);
    }
  }

  for (const asset of assets) {
    if (asset.kind) {
      kinds.add(asset.kind);
    }
  }

  for (const extension of extensions) {
    for (const kind of extension.trackKinds ?? extension.itemKinds ?? []) {
      kinds.add(kind);
    }
  }

  return [...kinds].sort((left, right) =>
    formatTimelineWorkbenchTrackKind(left).localeCompare(formatTimelineWorkbenchTrackKind(right)),
  );
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

export function getTimelineWorkbenchImportSourceLabel(sources: TimelineWorkbenchImportSource[]) {
  if (sources.length !== 1) {
    return `${sources.length} sources`;
  }

  const source = sources[0];

  return source?.label ?? source?.file?.name ?? source?.url ?? "reference";
}

export function getTimelineWorkbenchImportErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Import failed.";
}

export function uniquifyTimelineWorkbenchImportedAssets<TAssetData>(
  existingAssets: Array<TimelineWorkbenchAsset<TAssetData>>,
  importedAssets: Array<TimelineWorkbenchAsset<TAssetData>>,
) {
  const usedIds = new Set(existingAssets.map((asset) => asset.id));

  return importedAssets.map((asset) => {
    if (!usedIds.has(asset.id)) {
      usedIds.add(asset.id);
      return asset;
    }

    let index = 2;
    let id = `${asset.id}-import-${index}`;

    while (usedIds.has(id)) {
      index += 1;
      id = `${asset.id}-import-${index}`;
    }

    usedIds.add(id);
    return { ...asset, id };
  });
}
