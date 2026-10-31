import type { MenuActionItem } from "@moritzbrantner/ui";

import type {
  TimelineEditorDocument,
  TimelineEditorItem,
  TimelineEditorSelection,
  TimelineEditorTrackGroup,
} from "../../core";
import { getTimelineMediaTypeForItem } from "../../media-types";
import type { TimelineEditorItemContextMenuContext } from "../timeline-editor";
import type {
  TimelineEditorTimelineContextMenuContext,
  TimelineEditorTrackContextMenuContext,
  TimelineEditorTrackGroupContextMenuContext,
} from "../timeline-editor/types";
import {
  combineTimelineWorkbenchTimelineContextMenuItems,
  getTimelineWorkbenchTimelineContextMenuExtensionItems,
} from "./extensions";
import { createTimelineWorkbenchTrack } from "./ids";
import type { createTimelineWorkbenchItemLookup } from "./selection";
import type {
  TimelineWorkbenchAsset,
  TimelineWorkbenchItemContextMenuContext,
  TimelineWorkbenchProps,
  TimelineWorkbenchTimelineContextMenuContext,
} from "./types";
import { normalizeTimelineWorkbenchRange } from "./use-workbench-state";
import type { TimelineWorkbenchActions } from "./workbench-actions";
import type { TimelineWorkbenchCommandDispatcher } from "./workbench-commands";

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

type TimelineWorkbenchContextMenusOptions<
  TTrackData extends Record<string, unknown>,
  TItemData,
  TAssetData,
> = Pick<
  TimelineWorkbenchProps<TTrackData, TItemData, TAssetData>,
  "getItemContextMenuItems" | "getTimelineContextMenuItems"
> &
  Pick<TimelineWorkbenchCommandDispatcher<TTrackData, TItemData>, "runCommand"> & {
    actions: TimelineWorkbenchActions<TTrackData, TItemData, TAssetData>;
    document: TimelineEditorDocument<TTrackData, TItemData>;
    durationMs: number;
    currentTimeMs: number;
    extensions: NonNullable<
      TimelineWorkbenchProps<TTrackData, TItemData, TAssetData>["extensions"]
    >;
    itemLookup: ReturnType<typeof createTimelineWorkbenchItemLookup<TTrackData, TItemData>>;
    readOnly: boolean;
    resolvedSelection: TimelineEditorSelection;
  };

/** The workbench's item, track, track group and timeline context menus for one render. */
export function createTimelineWorkbenchContextMenus<
  TTrackData extends Record<string, unknown>,
  TItemData,
  TAssetData,
>({
  actions,
  document,
  durationMs,
  currentTimeMs,
  extensions,
  itemLookup,
  readOnly,
  resolvedSelection,
  getItemContextMenuItems,
  getTimelineContextMenuItems,
  runCommand,
}: TimelineWorkbenchContextMenusOptions<TTrackData, TItemData, TAssetData>) {
  const {
    addMarker,
    addTrackGroup,
    closeGap,
    deleteItems,
    deleteRange,
    duplicateItems,
    getRangeTargetTrackId,
    getTrackGroupForTrack,
    groupItems,
    hasItemGroup,
    insertAssetAt,
    insertGap,
    jumpCurrentTime,
    moveTrackWithinGroup,
    removeTimeline,
    removeTrackGroup,
    renameTrackGroup,
    splitItems,
    ungroupItems,
    updateItem,
    updateTrackGroup,
  } = actions;

  const getWorkbenchItemContextMenuItems = (
    context: TimelineEditorItemContextMenuContext<TTrackData, TItemData>,
  ): MenuActionItem[] => {
    return getTimelineWorkbenchContextMenuItems(context, {
      document,
      durationMs,
      itemLookup,
      readOnly,
      resolvedSelection,
      deleteItems,
      duplicateItems,
      getItemContextMenuItems,
      getExtensionContextMenuItems: (menuContext) =>
        extensions.flatMap((extension) => extension.contextMenuItems?.(menuContext) ?? []),
      groupItems,
      hasItemGroup,
      splitItems,
      ungroupItems,
      updateItem,
    });
  };

  const getWorkbenchTrackContextMenuItems = (
    context: TimelineEditorTrackContextMenuContext<TTrackData, TItemData>,
  ): MenuActionItem[] => {
    const trackIndex = document.tracks.findIndex((track) => track.id === context.track.id);
    const trackGroup = getTrackGroupForTrack(context.track.id);
    const groupTrackIndex = trackGroup?.trackIds.indexOf(context.track.id) ?? -1;

    return [
      {
        id: "lock-timeline",
        label: context.track.locked ? "Unlock Track" : "Lock Track",
        description: context.track.label,
        disabled: readOnly,
        onSelect: () =>
          runCommand({
            type: "update-track",
            trackId: context.track.id,
            patch: { locked: !context.track.locked },
          }),
      },
      {
        id: "move-timeline-up",
        label: "Move Track Up",
        disabled: readOnly || trackIndex <= 0,
        onSelect: () =>
          runCommand({ type: "move-track", trackId: context.track.id, toIndex: trackIndex - 1 }),
      },
      {
        id: "move-timeline-down",
        label: "Move Track Down",
        disabled: readOnly || trackIndex === -1 || trackIndex >= document.tracks.length - 1,
        onSelect: () =>
          runCommand({ type: "move-track", trackId: context.track.id, toIndex: trackIndex + 1 }),
      },
      {
        id: "duplicate-empty-timeline",
        label: "Duplicate Empty Track",
        disabled: readOnly,
        onSelect: () => {
          const track = createTimelineWorkbenchTrack(document.tracks);
          runCommand({
            type: "add-track",
            track: {
              ...track,
              label: `${context.track.label} Copy`,
              kind: context.track.kind,
              acceptsItemKinds: context.track.acceptsItemKinds,
              height: context.track.height,
              data: context.track.data,
            },
          });
        },
      },
      { id: "track-group-separator", type: "separator" },
      {
        id: "create-track-group",
        label: "Create Group From Track",
        disabled: readOnly || Boolean(trackGroup),
        onSelect: () => addTrackGroup([context.track.id], `${context.track.label} Group`),
      },
      ...(document.groups ?? [])
        .filter((group) => group.id !== trackGroup?.id)
        .map((group): MenuActionItem => ({
          id: `add-track-to-group-${group.id}`,
          label: `Add Track To ${group.label}`,
          disabled: readOnly || group.trackIds.includes(context.track.id),
          onSelect: () =>
            runCommand({
              type: "add-tracks-to-group",
              groupId: group.id,
              trackIds: [context.track.id],
            }),
        })),
      {
        id: "move-track-group-up",
        label: "Move Track Up In Group",
        disabled: readOnly || !trackGroup || groupTrackIndex <= 0,
        onSelect: () => moveTrackWithinGroup(context.track.id, -1),
      },
      {
        id: "move-track-group-down",
        label: "Move Track Down In Group",
        disabled:
          readOnly ||
          !trackGroup ||
          groupTrackIndex === -1 ||
          groupTrackIndex >= trackGroup.trackIds.length - 1,
        onSelect: () => moveTrackWithinGroup(context.track.id, 1),
      },
      {
        id: "remove-track-from-group",
        label: "Remove Track From Group",
        disabled: readOnly || !trackGroup,
        onSelect: () => {
          if (trackGroup) {
            runCommand({
              type: "remove-tracks-from-group",
              groupId: trackGroup.id,
              trackIds: [context.track.id],
            });
          }
        },
      },
      { id: "track-separator", type: "separator" },
      {
        id: "remove-timeline",
        label: "Remove Track",
        description: context.track.label,
        destructive: true,
        disabled: readOnly,
        onSelect: () => removeTimeline(context.track.id),
      },
    ];
  };

  const getTrackGroupActionItems = (
    group: TimelineEditorTrackGroup,
    options: { includeGroupLabel: boolean },
  ): MenuActionItem[] => {
    const suffix = options.includeGroupLabel ? ` ${group.label}` : " Group";

    return [
      {
        id: `rename-track-group-${group.id}`,
        label: `Rename${suffix}`,
        disabled: readOnly,
        onSelect: () => renameTrackGroup(group.id),
      },
      {
        id: `toggle-track-group-${group.id}`,
        label: group.collapsed ? `Expand${suffix}` : `Collapse${suffix}`,
        disabled: readOnly,
        onSelect: () => updateTrackGroup(group.id, { collapsed: !group.collapsed }),
      },
      {
        id: `lock-track-group-${group.id}`,
        label: group.locked ? `Unlock${suffix}` : `Lock${suffix}`,
        disabled: readOnly,
        onSelect: () => updateTrackGroup(group.id, { locked: !group.locked }),
      },
      {
        id: `dissolve-track-group-${group.id}`,
        label: `Dissolve${suffix}`,
        destructive: true,
        disabled: readOnly,
        onSelect: () => removeTrackGroup(group.id),
      },
    ];
  };

  const getWorkbenchTrackGroupContextMenuItems = (
    context: TimelineEditorTrackGroupContextMenuContext<TTrackData, TItemData>,
  ): MenuActionItem[] => getTrackGroupActionItems(context.group, { includeGroupLabel: false });

  const trackGroupMenuItems: MenuActionItem[] = [
    {
      id: "create-group-all-tracks",
      label: "Create Group From All Tracks",
      disabled: readOnly || document.tracks.length === 0,
      onSelect: () => addTrackGroup(document.tracks.map((track) => track.id)),
    },
    ...(document.groups?.length
      ? [{ id: "track-groups-separator", type: "separator" as const }]
      : []),
    ...(document.groups ?? []).flatMap((group): MenuActionItem[] =>
      getTrackGroupActionItems(group, { includeGroupLabel: true }),
    ),
  ];

  const getWorkbenchTimelineContextMenuItems = (
    context: TimelineEditorTimelineContextMenuContext<TTrackData, TItemData>,
  ): MenuActionItem[] => {
    const workbenchContext = {
      ...context,
      currentTimeMs,
      setCurrentTime: (timeMs = context.snappedTimeMs) => jumpCurrentTime(timeMs),
      addMarker: (timeMs = context.snappedTimeMs) => addMarker(timeMs),
      insertAsset: (
        asset: TimelineWorkbenchAsset<TAssetData>,
        placement?: { trackId?: string; timeMs?: number },
      ) =>
        insertAssetAt(asset, {
          trackId: placement?.trackId ?? context.track?.id,
          timeMs: placement?.timeMs ?? context.snappedTimeMs,
        }),
    } satisfies TimelineWorkbenchTimelineContextMenuContext<TTrackData, TItemData, TAssetData>;
    const consumerItems = getTimelineContextMenuItems?.(workbenchContext) ?? [];
    const extensionItems = getTimelineWorkbenchTimelineContextMenuExtensionItems(
      extensions,
      workbenchContext,
    );
    const range = normalizeTimelineWorkbenchRange(resolvedSelection.range);
    const rangeTrackId = getRangeTargetTrackId();
    const builtInItems: MenuActionItem[] = [
      {
        id: "set-playhead-here",
        label: "Set Playhead Here",
        onSelect: () => jumpCurrentTime(context.snappedTimeMs),
      },
      {
        id: "add-marker-here",
        label: "Add Marker Here",
        disabled: readOnly || context.locked,
        onSelect: () => addMarker(context.snappedTimeMs),
      },
      { id: "timeline-range-separator", type: "separator" },
      {
        id: "delete-selected-range",
        label: "Delete Selected Range",
        disabled: readOnly || !range,
        onSelect: () => deleteRange(range),
      },
      {
        id: "insert-gap-from-selected-range",
        label: "Insert Gap From Selected Range",
        disabled: readOnly || !range || !rangeTrackId,
        onSelect: () => {
          if (range && rangeTrackId) {
            insertGap(rangeTrackId, range.startMs, range.endMs - range.startMs);
          }
        },
      },
      {
        id: "close-selected-gap",
        label: "Close Selected Gap",
        disabled: readOnly || !range || !rangeTrackId,
        onSelect: () => {
          if (range && rangeTrackId) {
            closeGap(rangeTrackId, range.startMs, range.endMs);
          }
        },
      },
      ...(context.track
        ? [
            { id: "timeline-track-separator", type: "separator" as const },
            {
              id: "remove-track-from-timeline-menu",
              label: "Remove Track",
              description: context.track.label,
              destructive: true,
              disabled: readOnly || context.locked,
              onSelect: () => removeTimeline(context.track?.id),
            },
          ]
        : []),
    ];
    return combineTimelineWorkbenchTimelineContextMenuItems(
      builtInItems,
      consumerItems,
      extensionItems,
    );
  };

  return {
    getWorkbenchItemContextMenuItems,
    getWorkbenchTimelineContextMenuItems,
    getWorkbenchTrackContextMenuItems,
    getWorkbenchTrackGroupContextMenuItems,
    trackGroupMenuItems,
  };
}
