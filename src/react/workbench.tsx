"use client";

import { useMemo, useState } from "react";

import { type MenuActionItem, WorkbenchLayout, WorkbenchPanel, cn } from "@moritzbrantner/ui";

import {
  addTimelineEditorMarker,
  addTimelineEditorTrack,
  detectTimelineEditorOverlaps,
  duplicateTimelineEditorItems,
  formatTimelineEditorTimeMs,
  getTimelineEditorDurationMs,
  getTimelineEditorFrameDurationMs,
  getTimelineEditorGroupedItemIds,
  groupTimelineEditorItems,
  insertTimelineEditorItem,
  normalizeTimelineEditorDocument,
  normalizeTimelineEditorTracks,
  removeTimelineEditorItems,
  removeTimelineEditorTrack,
  splitTimelineEditorItems,
  type TimelineEditorDocument,
  type TimelineEditorItem,
  type TimelineEditorSelection,
  type TimelineEditorTrack,
  type TimelineEditorViewport,
  ungroupTimelineEditorItems,
} from "../core";
import {
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
  snapMs = 100,
  assets = [],
  className,
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

  const commitTracks = (tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>) => {
    commitDocument(normalizeTimelineEditorDocument({ ...document, tracks }, { durationMs }));
  };

  const commitSelection = (nextSelection: TimelineEditorSelection) => {
    onSelectionChange?.(nextSelection);
    onSelectedItemChange?.(getTimelineWorkbenchSelectionPayload(nextSelection, itemLookup));
  };

  const updateItem = (itemId: string, patch: Partial<TimelineEditorItem<TItemData>>) => {
    if (readOnly) {
      return;
    }

    const found = itemLookup.get(itemId);

    if (!found || found.item.locked || found.track.locked) {
      return;
    }

    commitTracks(
      normalizeTimelineEditorTracks(
        document.tracks.map((track) =>
          track.id === found.item.trackId
            ? {
                ...track,
                items: track.items.map((item) =>
                  item.id === found.item.id ? { ...item, ...patch } : item,
                ),
              }
            : track,
        ),
        { durationMs },
      ),
    );
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

    const groupedItemIds = getTimelineEditorGroupedItemIds(document, itemIds);
    commitTracks(removeTimelineEditorItems(document.tracks, groupedItemIds));
    commitSelection({ itemIds: [] });
  };

  const duplicateItems = (itemIds = resolvedSelection.itemIds) => {
    if (readOnly || itemIds.length === 0) {
      return;
    }

    commitTracks(
      duplicateTimelineEditorItems(
        document.tracks,
        getTimelineEditorGroupedItemIds(document, itemIds),
      ),
    );
  };

  const splitItems = (itemIds = resolvedSelection.itemIds) => {
    if (readOnly || itemIds.length === 0) {
      return;
    }

    commitTracks(
      splitTimelineEditorItems(
        document.tracks,
        getTimelineEditorGroupedItemIds(document, itemIds),
        currentTimeMs,
      ),
    );
  };

  const addTimeline = () => {
    if (readOnly) {
      return;
    }

    const track = createTimelineWorkbenchTrack(document.tracks);
    commitDocument(addTimelineEditorTrack(document, track, { durationMs }));
  };

  const removeTimeline = (trackId?: string) => {
    if (readOnly || document.tracks.length === 0) {
      return;
    }

    const resolvedTrackId = trackId ?? selectedTrack?.id ?? document.tracks.at(-1)?.id;

    if (!resolvedTrackId) {
      return;
    }

    commitDocument(removeTimelineEditorTrack(document, resolvedTrackId, { durationMs }));
    commitSelection({ itemIds: [] });
  };

  const groupItems = (itemIds = resolvedSelection.itemIds) => {
    if (readOnly || itemIds.length < 2) {
      return;
    }

    commitDocument(groupTimelineEditorItems(document, itemIds, {}, { durationMs }));
  };

  const ungroupItems = (itemIds = resolvedSelection.itemIds) => {
    if (readOnly || !hasItemGroup(itemIds)) {
      return;
    }

    commitDocument(ungroupTimelineEditorItems(document, itemIds, { durationMs }));
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

  const insertAsset = (asset: TimelineWorkbenchAsset<TAssetData>) => {
    const selectedTrackForPlacement =
      selectedTrack && canPlaceTimelineWorkbenchAssetOnTrack(asset, selectedTrack)
        ? selectedTrack
        : undefined;
    const targetTrack =
      selectedTrackForPlacement ??
      document.tracks.find((track) => canPlaceTimelineWorkbenchAssetOnTrack(asset, track));

    if (!targetTrack || readOnly) {
      return;
    }

    onAssetInsert?.(asset, { trackId: targetTrack.id, timeMs: currentTimeMs });

    if (onAssetInsert) {
      return;
    }

    const item = {
      id: createTimelineWorkbenchItemId(asset, createItemId),
      trackId: targetTrack.id,
      label: asset.label,
      startMs: currentTimeMs,
      durationMs: asset.durationMs,
      kind: asset.kind,
      color: asset.color,
      data: asset.data as TItemData | undefined,
    };

    commitTracks(
      insertTimelineEditorItem(document.tracks, item, { durationMs, snapMs: resolvedSnapMs }),
    );
    commitSelection({ itemIds: [item.id], anchorItemId: item.id });
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

  return (
    <WorkbenchLayout
      className={cn("min-h-[34rem] overflow-hidden border border-border bg-background", className)}
      leftPanel={
        <TimelineWorkbenchAssetsPanel
          assets={assets}
          readOnly={readOnly}
          renderAsset={renderAsset}
          onInsertAsset={insertAsset}
        />
      }
      rightPanel={
        <WorkbenchPanel side="right" className="min-w-72">
          {renderInspector ? (
            renderInspector(inspectorContext)
          ) : (
            <DefaultTimelineInspector
              context={inspectorContext}
              timingStepMs={resolvedSnapMs > 0 ? resolvedSnapMs : undefined}
            />
          )}
        </WorkbenchPanel>
      }
      toolbar={
        <TimelineWorkbenchToolbar
          document={document}
          durationMs={durationMs}
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
            commitDocument(addTimelineEditorMarker(document, marker, { durationMs }));
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
      }
    >
      <TimelineWorkbenchCanvas
        document={document}
        frameRate={frameRate}
        getItemContextMenuItems={getWorkbenchItemContextMenuItems}
        getTrackContextMenuItems={getWorkbenchTrackContextMenuItems}
        readOnly={readOnly}
        renderTimelineItem={renderTimelineItem}
        resolvedSelection={resolvedSelection}
        resolvedSnapMs={resolvedSnapMs}
        resolvedViewport={resolvedViewport}
        onAddTimeline={addTimeline}
        onCurrentTimeChange={onCurrentTimeChange}
        onDocumentChange={commitDocument}
        onSelectionChange={commitSelection}
        onViewportChange={commitViewport}
      />
    </WorkbenchLayout>
  );
}
