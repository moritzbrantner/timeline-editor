import type { TimelineEditorItem } from "./core";
import { getTimelineMediaTypeForItem } from "./media-types";
import type { TimelineEditorExtension } from "./react/workbench/types";

export type TimelineEditorExtensionMatchOptions<
  TItemData = Record<string, unknown>,
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TAssetData = Record<string, unknown>,
> = {
  predicate?: (extension: TimelineEditorExtension<TItemData, TTrackData, TAssetData>) => boolean;
};

export function getTimelineEditorItemDataDomain(data: unknown): string | undefined {
  if (!data || typeof data !== "object" || !("domain" in data)) {
    return undefined;
  }

  return typeof data.domain === "string" && data.domain.length > 0 ? data.domain : undefined;
}

export function getTimelineEditorDomainForItem(
  item: TimelineEditorItem<unknown>,
): string | undefined {
  return getTimelineEditorItemDataDomain(item.data);
}

export function doesTimelineEditorExtensionMatchItem<
  TItemData = Record<string, unknown>,
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TAssetData = Record<string, unknown>,
>(
  extension: TimelineEditorExtension<TItemData, TTrackData, TAssetData>,
  item: TimelineEditorItem<TItemData>,
): boolean {
  return (
    doesTimelineEditorExtensionMatchItemKind(extension, item) ||
    Boolean(extension.matchItem?.(item)) ||
    doesTimelineEditorExtensionMatchItemDomain(extension, item) ||
    doesTimelineEditorExtensionMatchItemMediaType(extension, item)
  );
}

export function findTimelineEditorExtensionForItem<
  TItemData = Record<string, unknown>,
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TAssetData = Record<string, unknown>,
>(
  item: TimelineEditorItem<TItemData>,
  extensions: Array<TimelineEditorExtension<TItemData, TTrackData, TAssetData>>,
  options: TimelineEditorExtensionMatchOptions<TItemData, TTrackData, TAssetData> = {},
): TimelineEditorExtension<TItemData, TTrackData, TAssetData> | undefined {
  const candidates = options.predicate ? extensions.filter(options.predicate) : extensions;

  return (
    candidates.find((extension) => doesTimelineEditorExtensionMatchItemKind(extension, item)) ??
    candidates.find((extension) => Boolean(extension.matchItem?.(item))) ??
    candidates.find((extension) => doesTimelineEditorExtensionMatchItemDomain(extension, item)) ??
    candidates.find((extension) => doesTimelineEditorExtensionMatchItemMediaType(extension, item))
  );
}

function doesTimelineEditorExtensionMatchItemKind<
  TItemData,
  TTrackData extends Record<string, unknown>,
  TAssetData,
>(
  extension: TimelineEditorExtension<TItemData, TTrackData, TAssetData>,
  item: TimelineEditorItem<TItemData>,
) {
  return Boolean(item.kind && extension.itemKinds?.includes(item.kind));
}

function doesTimelineEditorExtensionMatchItemDomain<
  TItemData,
  TTrackData extends Record<string, unknown>,
  TAssetData,
>(
  extension: TimelineEditorExtension<TItemData, TTrackData, TAssetData>,
  item: TimelineEditorItem<TItemData>,
) {
  const domain = getTimelineEditorDomainForItem(item as TimelineEditorItem<unknown>);

  return Boolean(domain && extension.domains?.includes(domain));
}

function doesTimelineEditorExtensionMatchItemMediaType<
  TItemData,
  TTrackData extends Record<string, unknown>,
  TAssetData,
>(
  extension: TimelineEditorExtension<TItemData, TTrackData, TAssetData>,
  item: TimelineEditorItem<TItemData>,
) {
  const mediaType = getTimelineMediaTypeForItem(item as TimelineEditorItem<unknown>);

  return Boolean(mediaType && extension.mediaTypes?.includes(mediaType));
}
