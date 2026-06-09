import type { ReactNode } from "react";

import type { MenuActionItem } from "@moritzbrantner/ui";

import type { TimelineEditorItem, TimelineEditorItemKind, TimelineEditorTrack } from "../../core";
import { findTimelineEditorExtensionForItem } from "../../extensions";
import type { TimelineEditorItemRenderContext } from "../timeline-editor/types";
import { formatTimelineWorkbenchTrackKind } from "./ids";
import type {
  TimelineEditorExtension,
  TimelineWorkbenchAsset,
  TimelineWorkbenchInspectorContext,
  TimelineWorkbenchTimelineContextMenuContext,
} from "./types";

export function getTimelineWorkbenchItemExtensions<
  TTrackData extends Record<string, unknown>,
  TItemData,
  TAssetData,
>(extensions: Array<TimelineEditorExtension<TItemData, TTrackData, TAssetData>>) {
  return extensions.filter(
    (extension) =>
      (extension.itemKinds && extension.itemKinds.length > 0) ||
      (extension.domains && extension.domains.length > 0) ||
      (extension.mediaTypes && extension.mediaTypes.length > 0) ||
      Boolean(extension.matchItem),
  );
}

export function getTimelineWorkbenchItemRenderExtension<
  TTrackData extends Record<string, unknown>,
  TItemData,
  TAssetData,
>(
  item: TimelineEditorItem<TItemData>,
  extensions: Array<TimelineEditorExtension<TItemData, TTrackData, TAssetData>>,
) {
  return findTimelineEditorExtensionForItem(item, extensions, {
    predicate: (extension) => Boolean(extension.renderItem),
  });
}

export function renderTimelineWorkbenchItem<
  TTrackData extends Record<string, unknown>,
  TItemData,
  TAssetData,
>(
  context: TimelineEditorItemRenderContext<TItemData>,
  extensions: Array<TimelineEditorExtension<TItemData, TTrackData, TAssetData>>,
  renderTimelineItem:
    | ((context: TimelineEditorItemRenderContext<TItemData>) => ReactNode)
    | undefined,
) {
  const extension = getTimelineWorkbenchItemRenderExtension(context.item, extensions);

  return extension?.renderItem?.(context) ?? renderTimelineItem?.(context);
}

export function getTimelineWorkbenchExtensionInspectorSections<
  TTrackData extends Record<string, unknown>,
  TItemData,
  TAssetData,
>(
  extensions: Array<TimelineEditorExtension<TItemData, TTrackData, TAssetData>>,
  context: TimelineWorkbenchInspectorContext<TItemData, TTrackData>,
) {
  return extensions.flatMap(
    (extension) =>
      extension.inspectorSections?.map((factory) =>
        factory({
          ...context,
          selectedTrack: context.selectedTrack,
        }),
      ) ?? [],
  );
}

export function getTimelineWorkbenchTimelineContextMenuExtensionItems<
  TTrackData extends Record<string, unknown>,
  TItemData,
  TAssetData,
>(
  extensions: Array<TimelineEditorExtension<TItemData, TTrackData, TAssetData>>,
  context: TimelineWorkbenchTimelineContextMenuContext<TTrackData, TItemData, TAssetData>,
) {
  return extensions.flatMap((extension) => extension.timelineContextMenuItems?.(context) ?? []);
}

export function combineTimelineWorkbenchTimelineContextMenuItems(
  builtInItems: MenuActionItem[],
  consumerItems: MenuActionItem[],
  extensionItems: MenuActionItem[],
) {
  const extraItems =
    consumerItems.length > 0 && extensionItems.length > 0
      ? [
          ...consumerItems,
          { id: "timeline-actions-separator", type: "separator" as const },
          ...extensionItems,
        ]
      : [...consumerItems, ...extensionItems];

  return extraItems.length > 0
    ? [
        ...builtInItems,
        { id: "timeline-extra-separator", type: "separator" as const },
        ...extraItems,
      ]
    : builtInItems;
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
