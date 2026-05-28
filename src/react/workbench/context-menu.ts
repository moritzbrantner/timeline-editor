import type { MenuActionItem } from "@moritzbrantner/ui";

import type {
  TimelineEditorDocument,
  TimelineEditorItem,
  TimelineEditorSelection,
} from "../../core";
import { getTimelineMediaTypeForItem } from "../../media-types";
import type { TimelineEditorItemContextMenuContext } from "../timeline-editor";
import type { TimelineWorkbenchItemContextMenuContext } from "./types";

type TimelineWorkbenchItemCommandMenuInput = {
  canUngroup: boolean;
  itemIds: string[];
  readOnly: boolean;
  deleteItems: (itemIds?: string[]) => void;
  duplicateItems: (itemIds?: string[]) => void;
  groupItems: (itemIds?: string[]) => void;
  splitItems: (itemIds?: string[]) => void;
  ungroupItems: (itemIds?: string[]) => void;
};

export function getTimelineWorkbenchItemCommandMenuItems({
  canUngroup,
  itemIds,
  readOnly,
  deleteItems,
  duplicateItems,
  groupItems,
  splitItems,
  ungroupItems,
}: TimelineWorkbenchItemCommandMenuInput): MenuActionItem[] {
  return [
    {
      id: "split",
      label: "Split at playhead",
      disabled: readOnly || itemIds.length === 0,
      onSelect: () => splitItems(itemIds),
    },
    {
      id: "duplicate",
      label: "Duplicate",
      disabled: readOnly || itemIds.length === 0,
      onSelect: () => duplicateItems(itemIds),
    },
    {
      id: "group",
      label: "Group",
      disabled: readOnly || itemIds.length < 2,
      onSelect: () => groupItems(itemIds),
    },
    {
      id: "ungroup",
      label: "Ungroup",
      disabled: readOnly || !canUngroup,
      onSelect: () => ungroupItems(itemIds),
    },
    { id: "item-command-separator", type: "separator" },
    {
      id: "delete",
      label: "Delete",
      destructive: true,
      disabled: readOnly || itemIds.length === 0,
      onSelect: () => deleteItems(itemIds),
    },
  ];
}

type TimelineWorkbenchItemContextMenuInput<
  TTrackData extends Record<string, unknown>,
  TItemData,
> = {
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
  itemLookup: Map<
    string,
    {
      item: TimelineEditorItem<TItemData>;
      track: TimelineEditorItemContextMenuContext<TTrackData, TItemData>["track"];
    }
  >;
  readOnly: boolean;
  resolvedSelection: TimelineEditorSelection;
  deleteItems: (itemIds?: string[]) => void;
  duplicateItems: (itemIds?: string[]) => void;
  getItemContextMenuItems?: (
    context: TimelineWorkbenchItemContextMenuContext<TTrackData, TItemData>,
  ) => MenuActionItem[];
  getExtensionContextMenuItems?: (
    context: TimelineWorkbenchItemContextMenuContext<TTrackData, TItemData>,
  ) => MenuActionItem[];
  groupItems: (itemIds?: string[]) => void;
  hasItemGroup: (itemIds: string[]) => boolean;
  splitItems: (itemIds?: string[]) => void;
  ungroupItems: (itemIds?: string[]) => void;
  updateItem: (itemId: string, patch: Partial<TimelineEditorItem<TItemData>>) => void;
};

export function getTimelineWorkbenchContextMenuItems<
  TTrackData extends Record<string, unknown>,
  TItemData,
>(
  context: TimelineEditorItemContextMenuContext<TTrackData, TItemData>,
  input: TimelineWorkbenchItemContextMenuInput<TTrackData, TItemData>,
): MenuActionItem[] {
  const itemIds = input.resolvedSelection.itemIds.includes(context.item.id)
    ? input.resolvedSelection.itemIds
    : [context.item.id];
  const menuSelection = input.resolvedSelection.itemIds.includes(context.item.id)
    ? input.resolvedSelection
    : { itemIds, anchorItemId: context.item.id };
  const contextSelectedItems = itemIds
    .map((itemId) => input.itemLookup.get(itemId)?.item)
    .filter((item): item is TimelineEditorItem<TItemData> => Boolean(item));
  const readOnlyContext = input.readOnly || context.readOnly;
  const menuContext = {
    document: input.document,
    durationMs: input.durationMs,
    item: context.item,
    itemIds,
    itemKind: context.item.kind,
    mediaType: getTimelineMediaTypeForItem(context.item),
    readOnly: readOnlyContext,
    selection: menuSelection,
    selectedItems: contextSelectedItems,
    track: context.track,
    deleteItems: input.deleteItems,
    duplicateItems: input.duplicateItems,
    groupItems: input.groupItems,
    splitItems: input.splitItems,
    ungroupItems: input.ungroupItems,
    updateItem: input.updateItem,
  } satisfies TimelineWorkbenchItemContextMenuContext<TTrackData, TItemData>;
  const extensionItems = input.getItemContextMenuItems?.(menuContext) ?? [];
  const contributedItems = input.getExtensionContextMenuItems?.(menuContext) ?? [];
  const defaultItems = getTimelineWorkbenchItemCommandMenuItems({
    canUngroup: input.hasItemGroup(itemIds),
    itemIds,
    readOnly: readOnlyContext,
    deleteItems: input.deleteItems,
    duplicateItems: input.duplicateItems,
    groupItems: input.groupItems,
    splitItems: input.splitItems,
    ungroupItems: input.ungroupItems,
  });

  const extraItems = [...extensionItems, ...contributedItems];

  return extraItems.length > 0
    ? [...defaultItems, { id: "media-actions", type: "separator" }, ...extraItems]
    : defaultItems;
}
