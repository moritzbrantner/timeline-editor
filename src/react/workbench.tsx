"use client";

import { useMemo, useState } from "react";

import { type MenuActionItem, WorkbenchPanel, cn } from "@moritzbrantner/ui";

import {
  detectTimelineEditorOverlaps,
  formatTimelineEditorTimeMs,
  getTimelineEditorDurationMs,
  getTimelineEditorFrameDurationMs,
  setTimelineEditorCurrentTime,
  type TimelineEditorDocument,
  type TimelineEditorItem,
  type TimelineEditorSelection,
  type TimelineEditorTrack,
  type TimelineEditorViewport,
} from "../core";
import type { TimelineEditorCommand } from "../commands";
import {
  applyTimelineEditorCommandWithHistory,
  createTimelineEditorHistory,
  redoTimelineEditorHistory,
  undoTimelineEditorHistory,
  type TimelineEditorHistory,
} from "../history";
import type {
  TimelineEditorItemContextMenuContext,
  TimelineEditorTrackContextMenuContext,
} from "./timeline-editor";
import {
  canPlaceTimelineWorkbenchAssetOnTrack,
  TimelineWorkbenchAssetsPanel,
} from "./workbench/assets";
import { TimelineWorkbenchCanvas } from "./workbench/canvas";
import { getTimelineWorkbenchContextMenuItems } from "./workbench/context-menu";
import {
  createTimelineWorkbenchItemId,
  createTimelineWorkbenchMarkerId,
  createTimelineWorkbenchTrack,
} from "./workbench/ids";
import { DefaultTimelineInspector } from "./workbench/inspector";
import {
  createTimelineWorkbenchItemLookup,
  getTimelineWorkbenchSelectedItems,
  getTimelineWorkbenchSelectionPayload,
} from "./workbench/selection";
import { TimelineWorkbenchToolbar } from "./workbench/toolbar";
import { TimelineWorkbenchPreview } from "./workbench/preview";
import type {
  TimelineWorkbenchAsset,
  TimelineWorkbenchInspectorContext,
  TimelineWorkbenchProps,
} from "./workbench/types";

export { defaultTimelineWorkbenchHotkeys } from "./workbench/toolbar";
export type {
  TimelineWorkbenchAsset,
  TimelineWorkbenchInspectorContext,
  TimelineWorkbenchItemContextMenuContext,
  TimelineWorkbenchProps,
  TimelineWorkbenchSelection,
} from "./workbench/types";

export function TimelineWorkbench<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TAssetData = Record<string, unknown>,
>({
  document,
  selectedItemId,
  selection,
  readOnly = false,
  pixelsPerSecond = 80,
  viewport,
  frameRate,
  editPolicy,
  snapMs = 100,
  virtualization,
  assets = [],
  className,
  style,
  createItemId,
  createMarkerId,
  onDocumentChange,
  onCurrentTimeChange,
  onSelectionChange,
  onSelectedItemChange,
  onViewportChange,
  onAssetInsert,
  renderAsset,
  renderInspector,
  renderTimelineItem,
  renderToolbarActions,
  getItemContextMenuItems,
}: TimelineWorkbenchProps<TTrackData, TItemData, TAssetData>) {
  const [internalViewport, setInternalViewport] = useState<TimelineEditorViewport>({
    pixelsPerSecond,
  });
  const [history, setHistory] = useState<TimelineEditorHistory<TTrackData, TItemData>>(
    () => createTimelineEditorHistory() as TimelineEditorHistory<TTrackData, TItemData>,
  );
  const resolvedViewport = viewport ?? internalViewport;
  const durationMs = document.durationMs ?? getTimelineEditorDurationMs(document.tracks, 30_000);
  const frameDurationMs = getTimelineEditorFrameDurationMs(frameRate);
  const resolvedSnapMs = frameDurationMs ?? snapMs;
  const currentTimeMs = document.currentTimeMs ?? 0;
  const frameStepMs = frameDurationMs ?? resolvedSnapMs;
  const resolvedSelection = selection ?? {
    itemIds: selectedItemId ? [selectedItemId] : [],
    anchorItemId: selectedItemId ?? undefined,
  };
  const itemLookup = useMemo(() => createTimelineWorkbenchItemLookup(document), [document]);
  const selectedItems = getTimelineWorkbenchSelectedItems(resolvedSelection, itemLookup);
  const selected = resolvedSelection.itemIds[0]
    ? itemLookup.get(resolvedSelection.itemIds[0])
    : undefined;
  const selectedItem = selected?.item;
  const selectedTrack = selected?.track;
  const hasItemGroup = (itemIds: string[]) =>
    itemIds.some((itemId) => Boolean(itemLookup.get(itemId)?.item.itemGroupId));
  const hasSelectedItemGroup = hasItemGroup(resolvedSelection.itemIds);
  const overlaps = useMemo(() => detectTimelineEditorOverlaps(document.tracks), [document.tracks]);

  const commitSelection = (nextSelection: TimelineEditorSelection) => {
    onSelectionChange?.(nextSelection);
    onSelectedItemChange?.(getTimelineWorkbenchSelectionPayload(nextSelection, itemLookup));
  };

  const commitDocument = (nextDocument: TimelineEditorDocument<TTrackData, TItemData>) => {
    if (nextDocument !== document) {
      setHistory((currentHistory) => ({
        undoStack: [
          ...currentHistory.undoStack,
          {
            id: `workbench-${Date.now()}-${currentHistory.undoStack.length + 1}`,
            label: "Edit timeline",
            before: document,
            after: nextDocument,
            selectionBefore: resolvedSelection,
            selectionAfter: resolvedSelection,
          },
        ],
        redoStack: [],
      }));
    }

    onDocumentChange?.(nextDocument);
  };

  const runCommand = (
    command: TimelineEditorCommand<TTrackData, TItemData>,
    commandSelection = resolvedSelection,
  ) => {
    const result = applyTimelineEditorCommandWithHistory(
      document,
      commandSelection,
      history,
      command,
      { durationMs, editPolicy, snapMs: resolvedSnapMs },
    );

    setHistory(result.history);

    if (result.changed) {
      onDocumentChange?.(result.document);
    }

    if (!areTimelineWorkbenchSelectionsEqual(result.selection, resolvedSelection)) {
      commitSelection(result.selection);
    }
  };

  const updateItem = (itemId: string, patch: Partial<TimelineEditorItem<TItemData>>) => {
    if (readOnly) {
      return;
    }

    const found = itemLookup.get(itemId);

    if (!found || found.item.locked || found.track.locked) {
      return;
    }

    runCommand({ type: "update-item", itemId, patch });
  };

  const updateSelectedItem = (patch: Partial<TimelineEditorItem<TItemData>>) => {
    if (selectedItem) {
      updateItem(selectedItem.id, patch);
    }
  };

  const deleteItems = (itemIds = resolvedSelection.itemIds) => {
    if (readOnly || itemIds.length === 0) {
      return;
    }

    runCommand({ type: "delete-selection" }, selectionForItemIds(itemIds));
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

  const addTimeline = () => {
    if (readOnly) {
      return;
    }

    const track = createTimelineWorkbenchTrack(document.tracks);
    runCommand({ type: "add-track", track });
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

  const inspectorContext = {
    document: document as TimelineEditorDocument<Record<string, unknown>, TItemData>,
    durationMs,
    readOnly,
    selection: resolvedSelection,
    selectedItem,
    selectedItems,
    selectedTrack: selectedTrack as TimelineEditorTrack<Record<string, unknown>, TItemData>,
    updateSelectedItem,
  } satisfies TimelineWorkbenchInspectorContext<TItemData>;

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
      canPlaceTimelineWorkbenchAssetOnTrack(asset, selectedTrack)
        ? selectedTrack
        : undefined;
    const targetTrack =
      requestedTrack && canPlaceTimelineWorkbenchAssetOnTrack(asset, requestedTrack)
        ? requestedTrack
        : (selectedTrackForPlacement ??
          document.tracks.find((track) => canPlaceTimelineWorkbenchAssetOnTrack(asset, track)));

    if (!targetTrack || readOnly) {
      return;
    }

    onAssetInsert?.(asset, { trackId: targetTrack.id, timeMs: placement.timeMs });

    if (onAssetInsert) {
      return;
    }

    const item = {
      id: createTimelineWorkbenchItemId(asset, createItemId),
      trackId: targetTrack.id,
      label: asset.label,
      startMs: placement.timeMs,
      durationMs: asset.durationMs,
      kind: asset.kind,
      color: asset.color,
      data: asset.data as TItemData | undefined,
    };

    runCommand({ type: "insert-item", item });
  };
  const insertAsset = (asset: TimelineWorkbenchAsset<TAssetData>) => {
    insertAssetAt(asset, { timeMs: currentTimeMs });
  };

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
      groupItems,
      hasItemGroup,
      splitItems,
      ungroupItems,
      updateItem,
    });
  };

  const getWorkbenchTrackContextMenuItems = (
    context: TimelineEditorTrackContextMenuContext<TTrackData, TItemData>,
  ): MenuActionItem[] => [
    {
      id: "remove-timeline",
      label: "Remove Timeline",
      description: context.track.label,
      destructive: true,
      disabled: readOnly,
      onSelect: () => removeTimeline(context.track.id),
    },
  ];

  const commitViewport = (nextViewport: TimelineEditorViewport) => {
    if (!viewport) {
      setInternalViewport(nextViewport);
    }

    onViewportChange?.(nextViewport);
  };

  const stepCurrentTimeByFrame = (direction: -1 | 1) => {
    if (readOnly || frameStepMs <= 0) {
      return;
    }

    const nextDocument = setTimelineEditorCurrentTime(
      document,
      currentTimeMs + direction * frameStepMs,
      { durationMs, snapMs: frameStepMs },
    );

    onCurrentTimeChange?.(nextDocument.currentTimeMs ?? 0);
    commitDocument(nextDocument);
  };

  return (
    <div
      data-slot="timeline-workbench"
      className={cn("grid overflow-hidden border border-border bg-background", className)}
      style={{
        gridTemplateRows: "auto minmax(0, 1fr) auto",
        height: "auto",
        minHeight: "34rem",
        ...style,
      }}
    >
      <TimelineWorkbenchToolbar
        currentTimeMs={currentTimeMs}
        document={document}
        durationMs={durationMs}
        frameStepMs={frameStepMs}
        hasSelectedItemGroup={hasSelectedItemGroup}
        history={history}
        inspectorContext={inspectorContext}
        overlaps={overlaps}
        pixelsPerSecond={pixelsPerSecond}
        readOnly={readOnly}
        renderToolbarActions={renderToolbarActions}
        resolvedSelection={resolvedSelection}
        resolvedViewport={resolvedViewport}
        onAddMarker={() => {
          const marker = {
            id: createTimelineWorkbenchMarkerId(currentTimeMs, createMarkerId),
            timeMs: currentTimeMs,
            label: formatTimelineEditorTimeMs(currentTimeMs),
          };
          runCommand({ type: "add-marker", marker });
        }}
        onDelete={() => deleteItems()}
        onDuplicate={() => duplicateItems()}
        onGroup={() => groupItems()}
        onRedo={() => {
          const redo = redoTimelineEditorHistory(history);
          setHistory(redo.history);
          if (redo.document) {
            onDocumentChange?.(redo.document);
            if (redo.selection) {
              commitSelection(redo.selection);
            }
          }
        }}
        onSplit={() => splitItems()}
        onStepFrame={stepCurrentTimeByFrame}
        onUndo={() => {
          const undo = undoTimelineEditorHistory(history);
          setHistory(undo.history);
          if (undo.document) {
            onDocumentChange?.(undo.document);
            if (undo.selection) {
              commitSelection(undo.selection);
            }
          }
        }}
        onUngroup={() => ungroupItems()}
        onViewportChange={commitViewport}
      />
      <div
        className="grid min-h-0 gap-3 overflow-auto border-b border-border/60 p-3"
        style={{
          gridTemplateColumns: "minmax(14rem, 9fr) minmax(18rem, 14fr) minmax(16rem, 10fr)",
        }}
      >
        <TimelineWorkbenchAssetsPanel
          className="h-full min-w-0"
          assets={assets}
          readOnly={readOnly}
          renderAsset={renderAsset}
          onInsertAsset={insertAsset}
        />
        <TimelineWorkbenchPreview
          currentTimeMs={currentTimeMs}
          document={document}
          durationMs={durationMs}
          selectedItems={selectedItems}
        />
        <WorkbenchPanel side="right" className="h-full min-w-0 p-0">
          {renderInspector ? (
            renderInspector(inspectorContext)
          ) : (
            <DefaultTimelineInspector
              context={inspectorContext}
              timingStepMs={resolvedSnapMs > 0 ? resolvedSnapMs : undefined}
            />
          )}
        </WorkbenchPanel>
      </div>
      <TimelineWorkbenchCanvas
        assets={assets}
        document={document}
        editPolicy={editPolicy}
        frameRate={frameRate}
        getItemContextMenuItems={getWorkbenchItemContextMenuItems}
        getTrackContextMenuItems={getWorkbenchTrackContextMenuItems}
        readOnly={readOnly}
        renderTimelineItem={renderTimelineItem}
        resolvedSelection={resolvedSelection}
        resolvedSnapMs={resolvedSnapMs}
        resolvedViewport={resolvedViewport}
        virtualization={virtualization}
        onAddTimeline={addTimeline}
        onCurrentTimeChange={onCurrentTimeChange}
        onDocumentChange={commitDocument}
        onDropAsset={insertAssetAt}
        onSelectionChange={commitSelection}
        onViewportChange={commitViewport}
      />
    </div>
  );
}

function selectionForItemIds(itemIds: string[]): TimelineEditorSelection {
  return { itemIds, anchorItemId: itemIds[0] };
}

function areTimelineWorkbenchSelectionsEqual(
  left: TimelineEditorSelection,
  right: TimelineEditorSelection,
) {
  if (left.anchorItemId !== right.anchorItemId || left.itemIds.length !== right.itemIds.length) {
    return false;
  }

  return left.itemIds.every((itemId, index) => itemId === right.itemIds[index]);
}
