import {
  canPlaceTimelineEditorItemOnTrack,
  formatTimelineEditorTimeMs,
  getTimelineEditorItemEndMs,
  normalizeTimelineEditorDocument,
  setTimelineEditorCurrentTime,
  type TimelineEditorClipboard,
  type TimelineEditorDocument,
  type TimelineEditorItem,
  type TimelineEditorItemKind,
  type TimelineEditorMarker,
  type TimelineEditorSelection,
  type TimelineEditorTimeMode,
  type TimelineEditorTimeRange,
  type TimelineEditorTrack,
  type TimelineEditorTrackGroup,
  type TimelineEditorTransformPoint,
  type TimelineEditorTransformPointPatch,
  type TimelineEditorTransformValues,
} from "../../core";
import {
  canPlaceTimelineWorkbenchAssetOnTrack,
  createTimelineWorkbenchItemFromAsset,
} from "./assets";
import {
  createTimelineWorkbenchMarkerId,
  createTimelineWorkbenchTrack,
  createTimelineWorkbenchTrackGroupId,
} from "./ids";
import type { createTimelineWorkbenchItemLookup } from "./selection";
import type { TimelineWorkbenchAsset, TimelineWorkbenchProps } from "./types";
import type { TimelineWorkbenchTransportController } from "./use-workbench-transport";
import {
  isTimelineWorkbenchTrackLocked,
  normalizeTimelineWorkbenchRange,
  selectionForItemIds,
} from "./use-workbench-state";
import type { TimelineWorkbenchCommandDispatcher } from "./workbench-commands";

type TimelineWorkbenchActionsOptions<
  TTrackData extends Record<string, unknown>,
  TItemData,
  TAssetData,
> = Pick<
  TimelineWorkbenchProps<TTrackData, TItemData, TAssetData>,
  "createItemId" | "createMarkerId" | "onAssetInsert" | "onCurrentTimeChange"
> &
  Pick<
    TimelineWorkbenchCommandDispatcher<TTrackData, TItemData>,
    "runCommand" | "runTransientCommand"
  > &
  Pick<TimelineWorkbenchTransportController, "pauseTransport" | "resolvedTransportState"> & {
    document: TimelineEditorDocument<TTrackData, TItemData>;
    durationMs: number;
    currentTimeMs: number;
    frameStepMs: number;
    readOnly: boolean;
    resolvedSelection: TimelineEditorSelection;
    resolvedClipboard: TimelineEditorClipboard<TItemData> | undefined;
    itemLookup: ReturnType<typeof createTimelineWorkbenchItemLookup<TTrackData, TItemData>>;
    selectedItem: TimelineEditorItem<TItemData> | undefined;
    selectedItems: Array<TimelineEditorItem<TItemData>>;
    selectedTrack: TimelineEditorTrack<TTrackData, TItemData> | undefined;
    commitDocument: (nextDocument: TimelineEditorDocument<TTrackData, TItemData>) => void;
    commitSelection: (nextSelection: TimelineEditorSelection) => void;
  };

export type TimelineWorkbenchActions<
  TTrackData extends Record<string, unknown>,
  TItemData,
  TAssetData,
> = ReturnType<typeof createTimelineWorkbenchActions<TTrackData, TItemData, TAssetData>>;

/**
 * The workbench's document, selection and playhead edits for one render. Every action closes over
 * that render's document and selection, so recreate them per render instead of caching them.
 */
export function createTimelineWorkbenchActions<
  TTrackData extends Record<string, unknown>,
  TItemData,
  TAssetData,
>({
  document,
  durationMs,
  currentTimeMs,
  frameStepMs,
  readOnly,
  resolvedSelection,
  resolvedClipboard,
  resolvedTransportState,
  itemLookup,
  selectedItem,
  selectedItems,
  selectedTrack,
  createItemId,
  createMarkerId,
  onAssetInsert,
  onCurrentTimeChange,
  commitDocument,
  commitSelection,
  pauseTransport,
  runCommand,
  runTransientCommand,
}: TimelineWorkbenchActionsOptions<TTrackData, TItemData, TAssetData>) {
  const hasItemGroup = (itemIds: string[]) =>
    itemIds.some((itemId) => Boolean(itemLookup.get(itemId)?.item.itemGroupId));

  const updateItem = (itemId: string, patch: Partial<TimelineEditorItem<TItemData>>) => {
    if (readOnly) {
      return;
    }

    const found = itemLookup.get(itemId);

    if (!found || found.item.locked || isTimelineWorkbenchTrackLocked(document, found.track)) {
      return;
    }

    runCommand({ type: "update-item", itemId, patch });
  };

  const updateSelectedItem = (patch: Partial<TimelineEditorItem<TItemData>>) => {
    if (selectedItem) {
      updateItem(selectedItem.id, patch);
    }
  };

  const updateSelectedItems = (
    patch:
      | Partial<TimelineEditorItem<TItemData>>
      | ((item: TimelineEditorItem<TItemData>) => Partial<TimelineEditorItem<TItemData>>),
  ) => {
    if (readOnly || selectedItems.length === 0) {
      return;
    }

    const selectedItemIds = new Set(selectedItems.map((item) => item.id));
    let changed = false;
    const tracks = document.tracks.map((track) => {
      if (
        isTimelineWorkbenchTrackLocked(document, track) ||
        !track.items.some((item) => selectedItemIds.has(item.id))
      ) {
        return track;
      }

      let trackChanged = false;
      const items = track.items.map((item) => {
        if (!selectedItemIds.has(item.id) || item.locked) {
          return item;
        }

        const itemPatch = typeof patch === "function" ? patch(item) : patch;
        const nextItem = {
          ...item,
          ...itemPatch,
          id: item.id,
          trackId: track.id,
        };

        if (!canPlaceTimelineEditorItemOnTrack(nextItem, track)) {
          return item;
        }

        trackChanged = true;
        changed = true;
        return nextItem;
      });

      return trackChanged ? { ...track, items } : track;
    });

    if (!changed) {
      return;
    }

    commitDocument(normalizeTimelineEditorDocument({ ...document, tracks }, { durationMs }));
  };

  const updateSelectedTrack = (
    patch: Partial<Omit<TimelineEditorTrack<TTrackData, TItemData>, "id" | "items">>,
  ) => {
    if (readOnly || !selectedTrack) {
      return;
    }

    runCommand({ type: "update-track", trackId: selectedTrack.id, patch });
  };

  const selectSelectedTrackItems = () => {
    if (!selectedTrack) {
      return;
    }

    runTransientCommand({ type: "select-track-items", trackId: selectedTrack.id });
  };

  const deleteItems = (itemIds = resolvedSelection.itemIds) => {
    if (readOnly || itemIds.length === 0) {
      return;
    }

    runCommand({ type: "delete-selection" }, selectionForItemIds(itemIds));
  };

  const cutItems = (itemIds = resolvedSelection.itemIds) => {
    if (readOnly || itemIds.length === 0) {
      return;
    }

    runCommand({ type: "cut-selection" }, selectionForItemIds(itemIds));
  };

  const pasteItems = () => {
    if (readOnly || !resolvedClipboard || resolvedClipboard.items.length === 0) {
      return;
    }

    runCommand({
      type: "paste-items",
      clipboard: resolvedClipboard,
      timeMs: currentTimeMs,
      trackId: selectedTrack?.id,
    });
  };

  const duplicateItems = (itemIds = resolvedSelection.itemIds) => {
    if (readOnly || itemIds.length === 0) {
      return;
    }

    runCommand({ type: "duplicate-selection" }, selectionForItemIds(itemIds));
  };

  const splitItems = (itemIds = resolvedSelection.itemIds) => {
    if (readOnly || itemIds.length === 0) {
      return;
    }

    runCommand({ type: "split-items", itemIds, timeMs: currentTimeMs });
  };

  const addMarker = (timeMs = currentTimeMs) => {
    if (readOnly) {
      return;
    }

    const marker = {
      id: createTimelineWorkbenchMarkerId(timeMs, createMarkerId),
      timeMs,
      label: formatTimelineEditorTimeMs(timeMs),
    };
    runCommand({ type: "add-marker", marker });
  };

  const updateMarker = (markerId: string, patch: Partial<TimelineEditorMarker>) => {
    if (readOnly) {
      return;
    }

    runCommand({ type: "update-marker", markerId, patch });
  };

  const removeMarker = (markerId: string) => {
    if (readOnly) {
      return;
    }

    runCommand({ type: "remove-marker", markerId });
    if (resolvedSelection.markerIds?.includes(markerId)) {
      commitSelection({ ...resolvedSelection, markerIds: undefined });
    }
  };

  const addTrack = (kind?: TimelineEditorItemKind) => {
    if (readOnly) {
      return;
    }

    const track = createTimelineWorkbenchTrack(document.tracks, kind);
    runCommand({ type: "add-track", track });
  };

  const addTrackGroup = (trackIds: string[], label?: string) => {
    if (readOnly || trackIds.length === 0) {
      return;
    }

    const groupIndex = (document.groups?.length ?? 0) + 1;
    runCommand({
      type: "add-track-group",
      group: {
        id: createTimelineWorkbenchTrackGroupId(document, label ?? "track-group"),
        label: label ?? `Group ${groupIndex}`,
        trackIds,
      },
    });
  };

  const renameTrackGroup = (groupId: string) => {
    if (readOnly) {
      return;
    }

    const group = document.groups?.find((candidate) => candidate.id === groupId);
    const label =
      typeof window === "undefined"
        ? group?.label
        : window.prompt("Track group name", group?.label ?? "Group");

    if (!label || label === group?.label) {
      return;
    }

    runCommand({ type: "update-track-group", groupId, patch: { label } });
  };

  const updateTrackGroup = (
    groupId: string,
    patch: Partial<Omit<TimelineEditorTrackGroup<Record<string, unknown>>, "id">>,
  ) => {
    if (readOnly) {
      return;
    }

    runCommand({ type: "update-track-group", groupId, patch });
  };

  const removeTrackGroup = (groupId: string) => {
    if (readOnly) {
      return;
    }

    runCommand({ type: "remove-track-group", groupId });
  };

  const getTrackGroupForTrack = (trackId: string) =>
    document.groups?.find((group) => group.trackIds.includes(trackId));

  const moveTrackWithinGroup = (trackId: string, direction: -1 | 1) => {
    const group = getTrackGroupForTrack(trackId);
    const currentIndex = group?.trackIds.indexOf(trackId) ?? -1;

    if (!group || currentIndex === -1) {
      return;
    }

    const nextIndex = currentIndex + direction;

    if (nextIndex < 0 || nextIndex >= group.trackIds.length) {
      return;
    }

    runCommand({
      type: "move-track-in-group",
      groupId: group.id,
      trackId,
      toIndex: nextIndex,
    });
  };

  const upsertSelectedTransformPoint = (
    point: TimelineEditorTransformPoint<TimelineEditorTransformValues>,
  ) => {
    if (readOnly || !selectedItem) {
      return;
    }

    runCommand({ type: "upsert-transform-point", itemId: selectedItem.id, point });
  };

  const updateSelectedTransformPoint = (
    offsetMs: number,
    patch: TimelineEditorTransformPointPatch<TimelineEditorTransformValues>,
  ) => {
    if (readOnly || !selectedItem) {
      return;
    }

    runCommand({ type: "update-transform-point", itemId: selectedItem.id, offsetMs, patch });
  };

  const moveSelectedTransformPoint = (fromOffsetMs: number, toOffsetMs: number) => {
    if (readOnly || !selectedItem) {
      return;
    }

    runCommand({
      type: "move-transform-point",
      itemId: selectedItem.id,
      fromOffsetMs,
      toOffsetMs,
    });
  };

  const removeSelectedTransformPoint = (offsetMs: number) => {
    if (readOnly || !selectedItem) {
      return;
    }

    runCommand({ type: "remove-transform-point", itemId: selectedItem.id, offsetMs });
  };

  const removeTimeline = (trackId?: string) => {
    if (readOnly || document.tracks.length === 0) {
      return;
    }

    const resolvedTrackId = trackId ?? selectedTrack?.id ?? document.tracks.at(-1)?.id;

    if (!resolvedTrackId) {
      return;
    }

    runCommand({ type: "remove-track", trackId: resolvedTrackId });
  };

  const removeSelectedTrack = () => removeTimeline(selectedTrack?.id);

  const groupItems = (itemIds = resolvedSelection.itemIds) => {
    if (readOnly || itemIds.length < 2) {
      return;
    }

    runCommand({ type: "group-selection" }, selectionForItemIds(itemIds));
  };

  const ungroupItems = (itemIds = resolvedSelection.itemIds) => {
    if (readOnly || !hasItemGroup(itemIds)) {
      return;
    }

    runCommand({ type: "ungroup-selection" }, selectionForItemIds(itemIds));
  };

  const jumpCurrentTime = (timeMs: number) => {
    if (readOnly) {
      return;
    }

    const nextDocument = setTimelineEditorCurrentTime(document, timeMs, {
      durationMs,
      snapMs: frameStepMs,
    });
    onCurrentTimeChange?.(nextDocument.currentTimeMs ?? 0);
    commitDocument(nextDocument);
  };

  const setRange = (range?: TimelineEditorTimeRange, trackIds?: string[]) => {
    runTransientCommand({ type: "set-range", range }, { ...resolvedSelection, trackIds });
  };

  const deleteRange = (range?: TimelineEditorTimeRange) => {
    if (readOnly) {
      return;
    }

    runCommand({ type: "delete-range", range });
  };

  const insertGap = (trackId: string, startMs: number, gapDurationMs: number) => {
    if (readOnly) {
      return;
    }

    runCommand({ type: "insert-gap", trackId, startMs, durationMs: gapDurationMs });
  };

  const closeGap = (trackId: string, startMs: number, endMs: number) => {
    if (readOnly) {
      return;
    }

    runCommand({ type: "close-gap", trackId, startMs, endMs });
  };

  const getRangeTargetTrackId = () =>
    resolvedSelection.trackIds?.[0] ??
    selectedTrack?.id ??
    document.tracks.find((track) => !isTimelineWorkbenchTrackLocked(document, track))?.id;

  const insertSelectedRangeGap = () => {
    const range = normalizeTimelineWorkbenchRange(resolvedSelection.range);
    const trackId = getRangeTargetTrackId();

    if (!range || !trackId) {
      return;
    }

    insertGap(trackId, range.startMs, range.endMs - range.startMs);
  };

  const closeSelectedRangeGap = () => {
    const range = normalizeTimelineWorkbenchRange(resolvedSelection.range);
    const trackId = getRangeTargetTrackId();

    if (!range || !trackId) {
      return;
    }

    closeGap(trackId, range.startMs, range.endMs);
  };

  const insertAssetAt = (
    asset: TimelineWorkbenchAsset<TAssetData>,
    placement: { trackId?: string; timeMs: number },
  ) => {
    const requestedTrack = placement.trackId
      ? document.tracks.find((track) => track.id === placement.trackId)
      : undefined;
    const selectedTrackForPlacement =
      !requestedTrack &&
      selectedTrack &&
      canPlaceTimelineWorkbenchAssetOnTrack(asset, selectedTrack) &&
      !isTimelineWorkbenchTrackLocked(document, selectedTrack)
        ? selectedTrack
        : undefined;
    const targetTrack =
      requestedTrack &&
      canPlaceTimelineWorkbenchAssetOnTrack(asset, requestedTrack) &&
      !isTimelineWorkbenchTrackLocked(document, requestedTrack)
        ? requestedTrack
        : (selectedTrackForPlacement ??
          document.tracks.find(
            (track) =>
              canPlaceTimelineWorkbenchAssetOnTrack(asset, track) &&
              !isTimelineWorkbenchTrackLocked(document, track),
          ));

    if (!targetTrack || readOnly) {
      return;
    }

    onAssetInsert?.(asset, { trackId: targetTrack.id, timeMs: placement.timeMs });

    if (onAssetInsert) {
      return;
    }

    const item = createTimelineWorkbenchItemFromAsset<TItemData, TAssetData>(
      asset,
      { trackId: targetTrack.id, timeMs: placement.timeMs },
      { createItemId },
    );

    runCommand({ type: "insert-item", item });
  };
  const insertAsset = (asset: TimelineWorkbenchAsset<TAssetData>) => {
    insertAssetAt(asset, { timeMs: currentTimeMs });
  };

  const stepCurrentTimeByFrame = (direction: -1 | 1) => {
    if (readOnly || frameStepMs <= 0) {
      return;
    }

    if (resolvedTransportState.status === "playing") {
      pauseTransport("pause");
    }

    const nextDocument = setTimelineEditorCurrentTime(
      document,
      currentTimeMs + direction * frameStepMs,
      { durationMs, snapMs: frameStepMs },
    );

    onCurrentTimeChange?.(nextDocument.currentTimeMs ?? 0);
    commitDocument(nextDocument);
  };

  const jumpToAdjacentMarker = (direction: -1 | 1) => {
    const markers = [...(document.markers ?? [])].sort((left, right) => left.timeMs - right.timeMs);
    const marker =
      direction < 0
        ? [...markers].reverse().find((candidate) => candidate.timeMs < currentTimeMs)
        : markers.find((candidate) => candidate.timeMs > currentTimeMs);

    if (marker) {
      jumpCurrentTime(marker.timeMs);
    }
  };

  const jumpToAdjacentItemEdge = (direction: -1 | 1) => {
    const edges = document.tracks
      .flatMap((track) =>
        track.items.flatMap((item) => [item.startMs, getTimelineEditorItemEndMs(item)]),
      )
      .filter((timeMs) => (direction < 0 ? timeMs < currentTimeMs : timeMs > currentTimeMs))
      .sort((left, right) => left - right);
    const timeMs = direction < 0 ? edges.at(-1) : edges[0];

    if (timeMs !== undefined) {
      jumpCurrentTime(timeMs);
    }
  };

  return {
    addMarker,
    addTrack,
    addTrackGroup,
    closeGap,
    closeSelectedRangeGap,
    cutItems,
    deleteItems,
    deleteRange,
    duplicateItems,
    getRangeTargetTrackId,
    getTrackGroupForTrack,
    groupItems,
    hasItemGroup,
    insertAsset,
    insertAssetAt,
    insertGap,
    insertSelectedRangeGap,
    jumpCurrentTime,
    jumpToAdjacentItemEdge,
    jumpToAdjacentMarker,
    moveSelectedTransformPoint,
    moveTrackWithinGroup,
    pasteItems,
    removeMarker,
    removeSelectedTrack,
    removeSelectedTransformPoint,
    removeTimeline,
    removeTrackGroup,
    renameTrackGroup,
    selectSelectedTrackItems,
    setRange,
    splitItems,
    stepCurrentTimeByFrame,
    ungroupItems,
    updateItem,
    updateMarker,
    updateSelectedItem,
    updateSelectedItems,
    updateSelectedTrack,
    updateSelectedTransformPoint,
    updateTrackGroup,
    upsertSelectedTransformPoint,
  };
}

/** Toolbar button handlers: the same actions, each also announced to screen readers. */
export function getTimelineWorkbenchToolbarActions<
  TTrackData extends Record<string, unknown>,
  TItemData,
  TAssetData,
>(
  actions: TimelineWorkbenchActions<TTrackData, TItemData, TAssetData>,
  commands: TimelineWorkbenchCommandDispatcher<TTrackData, TItemData>,
  options: {
    range: TimelineEditorTimeRange | undefined;
    timeMode: TimelineEditorTimeMode;
    announce: (message: string) => void;
  },
) {
  const { announce } = options;

  return {
    onAddMarker: () => {
      actions.addMarker();
      announce("Marker added");
    },
    onDelete: () => {
      actions.deleteItems();
      announce("Selection deleted");
    },
    onDeleteRange: () => {
      actions.deleteRange(options.range);
      announce("Range deleted");
    },
    onCopy: () => {
      commands.copyItems();
      announce("Selection copied");
    },
    onCut: () => {
      actions.cutItems();
      announce("Selection cut");
    },
    onDuplicate: () => {
      actions.duplicateItems();
      announce("Selection duplicated");
    },
    onGroup: () => {
      actions.groupItems();
      announce("Items grouped");
    },
    onInsertGap: () => {
      actions.insertSelectedRangeGap();
      announce("Gap inserted");
    },
    onCloseGap: () => {
      actions.closeSelectedRangeGap();
      announce("Gap closed");
    },
    onPaste: () => {
      actions.pasteItems();
      announce("Clipboard pasted");
    },
    onRedo: () => {
      if (commands.redoHistory()) {
        announce("Redo applied");
      }
    },
    onSplit: () => {
      actions.splitItems();
      announce("Selection split");
    },
    onStepFrame: (direction: -1 | 1) => {
      actions.stepCurrentTimeByFrame(direction);
      const stepLabel = options.timeMode === "frames" ? "frame" : "step";
      announce(direction < 0 ? `Moved to previous ${stepLabel}` : `Moved to next ${stepLabel}`);
    },
    onUndo: () => {
      if (commands.undoHistory()) {
        announce("Undo applied");
      }
    },
    onUngroup: () => {
      actions.ungroupItems();
      announce("Items ungrouped");
    },
  };
}
