"use client";

import { useMemo, useState } from "react";
import { useControllableEditorState } from "@moenarch/editor-core/react";

import {
  detectTimelineEditorOverlaps,
  getTimelineEditorDurationMs,
  getTimelineEditorFrameDurationMs,
  resolveTimelineEditorTimeMode,
  type TimelineEditorDocument,
  type TimelineEditorClipboard,
  type TimelineEditorSelection,
  type TimelineEditorSnapOptions,
  type TimelineEditorTool,
  type TimelineEditorTrack,
  type TimelineEditorTrackGroup,
  type TimelineEditorViewport,
} from "../../core";
import { createTimelineEditorHistory, type TimelineEditorHistory } from "../../history";
import { timelineEditorMinPixelsPerSecond } from "../timeline-editor/constants";
import type { TimelineEditorItemRenderContext } from "../timeline-editor/types";
import type { TimelineWorkbenchHotkeyId } from "./hotkeys";
import { TimelineWorkbenchAssetsPanel } from "./assets";
import { TimelineWorkbenchCanvas } from "./canvas";
import { createTimelineWorkbenchContextMenus } from "./context-menu";
import {
  getTimelineWorkbenchExtensionInspectorSections,
  getTimelineWorkbenchItemExtensions,
  getTimelineWorkbenchTrackKinds,
  renderTimelineWorkbenchItem,
} from "./extensions";
import { formatTimelineWorkbenchTrackKind } from "./ids";
import { DefaultTimelineInspector } from "./inspector";
import { shouldShowTimelineWorkbenchAssetsPanel, TimelineWorkbenchShellLayout } from "./panels";
import {
  createTimelineWorkbenchItemLookup,
  createTimelineWorkbenchTrackLookup,
  getTimelineWorkbenchSelectedItems,
  getTimelineWorkbenchSelectionPayload,
} from "./selection";
import { TimelineWorkbenchToolbar, defaultTimelineWorkbenchHotkeys } from "./toolbar";
import { TimelineWorkbenchTrackGroupHeader } from "./track-group-header";
import { TimelineWorkbenchPreview } from "./preview";
import { TimelineWorkbenchTransport } from "./transport";
import { handleTimelineWorkbenchKeyDown } from "./use-workbench-hotkeys";
import { useTimelineWorkbenchImports } from "./use-workbench-imports";
import { useTimelineWorkbenchTransport } from "./use-workbench-transport";
import { isTimelineWorkbenchCurrentTimeOnlyChange } from "./use-workbench-state";
import {
  createTimelineWorkbenchActions,
  getTimelineWorkbenchToolbarActions,
} from "./workbench-actions";
import { createTimelineWorkbenchCommandDispatcher } from "./workbench-commands";
import type {
  TimelineWorkbenchInspectorContext,
  TimelineWorkbenchPreviewMode,
  TimelineWorkbenchProps,
} from "./types";

export { defaultTimelineWorkbenchHotkeys } from "./toolbar";
export type {
  TimelineWorkbenchAsset,
  TimelineEditorExtension,
  TimelineWorkbenchImportContext,
  TimelineWorkbenchImportProgress,
  TimelineWorkbenchImportResult,
  TimelineWorkbenchImportSource,
  TimelineWorkbenchImportSourceState,
  TimelineWorkbenchImportState,
  TimelineWorkbenchInspectorContext,
  TimelineWorkbenchInspectorSchema,
  TimelineWorkbenchItemContextMenuContext,
  TimelineWorkbenchMediaErrorCode,
  TimelineWorkbenchMediaStatus,
  TimelineWorkbenchProps,
  TimelineWorkbenchPreviewMode,
  TimelineWorkbenchSelection,
  TimelineWorkbenchTimelineContextMenuContext,
  TimelineWorkbenchTimelineContextMenuFactory,
  TimelinePreviewContext,
  TimelinePreviewTransportContext,
  TimelineWorkbenchPlaybackRate,
  TimelineWorkbenchTransportChangeReason,
  TimelineWorkbenchTransportState,
  TimelineWorkbenchTransportStateChangeContext,
  TimelineWorkbenchTransportStatus,
} from "./types";

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
  minPixelsPerSecond = timelineEditorMinPixelsPerSecond,
  viewport,
  frameRate,
  timeMode,
  editPolicy,
  snapMs = 100,
  snap,
  minItemDurationMs,
  tool,
  onToolChange,
  virtualization,
  clipboard,
  onClipboardChange,
  history,
  onHistoryChange,
  hotkeys,
  onHotkeysChange,
  previewMode,
  onPreviewModeChange,
  transportState,
  defaultTransportState,
  onTransportStateChange,
  onSnapChange,
  extensions = [],
  inspectorSchema,
  assets = [],
  onImportAssets,
  onImportCancel,
  acceptedImportTypes,
  allowUrlImport,
  showAssetsPanel = true,
  showPreviewPanel = true,
  showInspectorPanel = true,
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
  getTimelineContextMenuItems,
}: TimelineWorkbenchProps<TTrackData, TItemData, TAssetData>) {
  const [resolvedViewport, commitViewport] = useControllableEditorState<TimelineEditorViewport>({
    value: viewport,
    defaultValue: { pixelsPerSecond },
    onChange: onViewportChange,
  });
  const [resolvedHistory, commitHistory] = useControllableEditorState<
    TimelineEditorHistory<TTrackData, TItemData>
  >({
    value: history,
    defaultValue: () =>
      createTimelineEditorHistory() as TimelineEditorHistory<TTrackData, TItemData>,
    onChange: onHistoryChange,
  });
  const [resolvedClipboard, commitClipboard] = useControllableEditorState<
    TimelineEditorClipboard<TItemData> | undefined
  >({
    value: clipboard,
    defaultValue: undefined,
    onChange: onClipboardChange,
  });
  const [resolvedTool, commitTool] = useControllableEditorState<TimelineEditorTool>({
    value: tool,
    defaultValue: tool ?? "select",
    onChange: onToolChange,
  });
  const [inputSnap, commitSnap] = useControllableEditorState<Partial<TimelineEditorSnapOptions>>({
    value: snap,
    defaultValue: {},
    onChange: onSnapChange,
  });
  const [customHotkeys, setCustomHotkeys] = useState<
    Partial<typeof defaultTimelineWorkbenchHotkeys>
  >({});
  const [resolvedPreviewMode, commitPreviewMode] =
    useControllableEditorState<TimelineWorkbenchPreviewMode>({
      value: previewMode,
      defaultValue: "active-scene",
      onChange: onPreviewModeChange,
    });
  const [draggedAssetId, setDraggedAssetId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const { importState, resolvedAssets, importAssets, cancelImport, retryImport, clearImportState } =
    useTimelineWorkbenchImports({
      assets,
      readOnly,
      onImportAssets,
      onImportCancel,
    });
  const durationMs = document.durationMs ?? getTimelineEditorDurationMs(document.tracks, 30_000);
  const resolvedTimeMode = resolveTimelineEditorTimeMode(timeMode, frameRate);
  const frameSlotDurationMs = getTimelineEditorFrameDurationMs(frameRate);
  const resolvedSnapMs = frameSlotDurationMs ?? snapMs;
  const currentTimeMs = document.currentTimeMs ?? 0;
  const frameStepMs = frameSlotDurationMs ?? resolvedSnapMs;
  const resolvedHotkeys = { ...defaultTimelineWorkbenchHotkeys, ...hotkeys, ...customHotkeys };
  const defaultSnapTargets: TimelineEditorSnapOptions["targets"] = [
    { type: "interval", intervalMs: resolvedSnapMs },
    { type: "marker" },
    { type: "item-edge" },
    { type: "playhead" },
  ];
  const resolvedSnap: Partial<TimelineEditorSnapOptions> = {
    enabled: inputSnap.enabled ?? resolvedSnapMs > 0,
    thresholdPx: inputSnap.thresholdPx ?? 8,
    targets: inputSnap.targets ?? defaultSnapTargets,
  };
  const resolvedSelection = selection ?? {
    itemIds: selectedItemId ? [selectedItemId] : [],
    anchorItemId: selectedItemId ?? undefined,
  };
  // Keyed on tracks, not document: the document changes on every playhead tick.
  const itemLookup = useMemo(() => createTimelineWorkbenchItemLookup(document), [document.tracks]);
  const trackLookup = useMemo(
    () => createTimelineWorkbenchTrackLookup(document),
    [document.tracks],
  );
  const selectedItems = getTimelineWorkbenchSelectedItems(resolvedSelection, itemLookup);
  const selected = resolvedSelection.itemIds[0]
    ? itemLookup.get(resolvedSelection.itemIds[0])
    : undefined;
  const selectedItem = selected?.item;
  const selectedTrack =
    (resolvedSelection.trackIds?.[0]
      ? trackLookup.get(resolvedSelection.trackIds[0])
      : undefined) ?? selected?.track;
  const overlaps = useMemo(() => detectTimelineEditorOverlaps(document.tracks), [document.tracks]);
  const extensionItems = useMemo(
    () => getTimelineWorkbenchItemExtensions(extensions),
    [extensions],
  );
  const trackKinds = useMemo(
    () => getTimelineWorkbenchTrackKinds(document.tracks, resolvedAssets, extensions),
    [document.tracks, extensions, resolvedAssets],
  );
  const hasTimelineContextMenuItems = true;

  const commitSelection = (nextSelection: TimelineEditorSelection) => {
    onSelectionChange?.(nextSelection);
    onSelectedItemChange?.(
      getTimelineWorkbenchSelectionPayload(nextSelection, itemLookup, trackLookup),
    );
  };

  const commitDocument = (nextDocument: TimelineEditorDocument<TTrackData, TItemData>) => {
    if (
      nextDocument !== document &&
      !isTimelineWorkbenchCurrentTimeOnlyChange(document, nextDocument)
    ) {
      commitHistory({
        undoStack: [
          ...resolvedHistory.undoStack,
          {
            id: `workbench-${Date.now()}-${resolvedHistory.undoStack.length + 1}`,
            label: "Edit timeline",
            before: document,
            after: nextDocument,
            selectionBefore: resolvedSelection,
            selectionAfter: resolvedSelection,
          },
        ],
        redoStack: [],
      });
    }

    onDocumentChange?.(nextDocument);
  };

  const {
    resolvedTransportState,
    transportLoopRange,
    previewTransportContext,
    pauseTransport,
    toggleTransport,
    stopTransport,
    shuttleForward,
    shuttleBackward,
    toggleLoop,
  } = useTimelineWorkbenchTransport({
    document,
    durationMs,
    currentTimeMs,
    readOnly,
    selection: resolvedSelection,
    transportState,
    defaultTransportState,
    onTransportStateChange,
    onCurrentTimeChange,
    commitDocument,
  });

  const commandDispatcher = createTimelineWorkbenchCommandDispatcher({
    document,
    selection: resolvedSelection,
    history: resolvedHistory,
    clipboard: resolvedClipboard,
    durationMs,
    editPolicy,
    snapMs: resolvedSnapMs,
    minItemDurationMs,
    commitHistory,
    commitClipboard,
    commitSelection,
    onDocumentChange,
  });
  const { runCommand, runTransientCommand, undoHistory, redoHistory, copyItems } =
    commandDispatcher;

  const actions = createTimelineWorkbenchActions<TTrackData, TItemData, TAssetData>({
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
  });
  const hasSelectedItemGroup = actions.hasItemGroup(resolvedSelection.itemIds);

  const inspectorContext = {
    document: document as TimelineEditorDocument<TTrackData, TItemData>,
    durationMs,
    readOnly,
    selection: resolvedSelection,
    selectedItem,
    selectedItems,
    selectedTrack: selectedTrack as TimelineEditorTrack<TTrackData, TItemData> | undefined,
    setCurrentTime: (timeMs = currentTimeMs) => actions.jumpCurrentTime(timeMs),
    addMarker: actions.addMarker,
    updateMarker: actions.updateMarker,
    removeMarker: actions.removeMarker,
    setRange: actions.setRange,
    deleteRange: actions.deleteRange,
    insertGap: actions.insertGap,
    closeGap: actions.closeGap,
    updateSelectedItem: actions.updateSelectedItem,
    updateSelectedItems: actions.updateSelectedItems,
    updateSelectedTrack: actions.updateSelectedTrack,
    removeSelectedTrack: actions.removeSelectedTrack,
    selectSelectedTrackItems: actions.selectSelectedTrackItems,
    upsertSelectedTransformPoint: actions.upsertSelectedTransformPoint,
    updateSelectedTransformPoint: actions.updateSelectedTransformPoint,
    moveSelectedTransformPoint: actions.moveSelectedTransformPoint,
    removeSelectedTransformPoint: actions.removeSelectedTransformPoint,
  } satisfies TimelineWorkbenchInspectorContext<TItemData, TTrackData>;

  const extensionInspectorSections = getTimelineWorkbenchExtensionInspectorSections(
    extensions,
    inspectorContext,
  );

  const renderResolvedTimelineItem = (context: TimelineEditorItemRenderContext<TItemData>) => {
    return renderTimelineWorkbenchItem(context, extensionItems, renderTimelineItem);
  };
  const {
    getWorkbenchItemContextMenuItems,
    getWorkbenchTimelineContextMenuItems,
    getWorkbenchTrackContextMenuItems,
    getWorkbenchTrackGroupContextMenuItems,
    trackGroupMenuItems,
  } = createTimelineWorkbenchContextMenus<TTrackData, TItemData, TAssetData>({
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
  });

  const commitHotkey = (id: TimelineWorkbenchHotkeyId, hotkey: string) => {
    const nextHotkeys = { ...customHotkeys, [id]: hotkey };
    setCustomHotkeys(nextHotkeys);
    onHotkeysChange?.(nextHotkeys);
  };

  const resetHotkeys = () => {
    setCustomHotkeys({});
    onHotkeysChange?.({});
  };
  const handleWorkbenchKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    handleTimelineWorkbenchKeyDown(event, resolvedHotkeys, readOnly, {
      toggleTransport,
      stopTransport,
      shuttleForward,
      shuttleBackward,
      toggleLoop,
      undo: undoHistory,
      redo: redoHistory,
      deleteItems: () => actions.deleteItems(),
      copyItems: () => copyItems(),
      cutItems: () => actions.cutItems(),
      pasteItems: actions.pasteItems,
      splitItems: () => actions.splitItems(),
      duplicateItems: () => actions.duplicateItems(),
      groupItems: () => actions.groupItems(),
      ungroupItems: () => actions.ungroupItems(),
      addMarker: () => actions.addMarker(),
      clearSelection: () => runTransientCommand({ type: "clear-selection" }),
      stepFrame: actions.stepCurrentTimeByFrame,
      jumpStart: () => actions.jumpCurrentTime(0),
      jumpEnd: () => actions.jumpCurrentTime(durationMs),
      jumpToAdjacentMarker: actions.jumpToAdjacentMarker,
      jumpToAdjacentItemEdge: actions.jumpToAdjacentItemEdge,
      setTool: commitTool,
    });
  };

  const renderTrackGroupHeader = (context: {
    group: TimelineEditorTrackGroup;
    locked: boolean;
  }) => (
    <TimelineWorkbenchTrackGroupHeader
      context={context}
      readOnly={readOnly}
      updateTrackGroup={actions.updateTrackGroup}
      renameTrackGroup={actions.renameTrackGroup}
      removeTrackGroup={actions.removeTrackGroup}
    />
  );
  const announce = (message: string) => {
    setAnnouncement(message);
  };
  const shouldShowAssetsPanel = shouldShowTimelineWorkbenchAssetsPanel({
    showAssetsPanel,
    assetCount: resolvedAssets.length,
    hasImporter: Boolean(onImportAssets),
  });
  const toolbarContent = (
    <TimelineWorkbenchToolbar
      announcement={announcement}
      clipboard={resolvedClipboard}
      currentTimeMs={currentTimeMs}
      document={document}
      durationMs={durationMs}
      frameStepMs={frameStepMs}
      hasSelectedItemGroup={hasSelectedItemGroup}
      history={resolvedHistory}
      inspectorContext={inspectorContext}
      overlaps={overlaps}
      pixelsPerSecond={pixelsPerSecond}
      minPixelsPerSecond={minPixelsPerSecond}
      readOnly={readOnly}
      resolvedHotkeys={resolvedHotkeys}
      resolvedSnap={resolvedSnap}
      resolvedTimeMode={resolvedTimeMode}
      resolvedTool={resolvedTool}
      renderToolbarActions={renderToolbarActions}
      resolvedSelection={resolvedSelection}
      resolvedViewport={resolvedViewport}
      {...getTimelineWorkbenchToolbarActions(actions, commandDispatcher, {
        range: resolvedSelection.range,
        timeMode: resolvedTimeMode,
        announce,
      })}
      onViewportChange={commitViewport}
      onToolChange={commitTool}
      onSnapChange={commitSnap}
      onHotkeyChange={commitHotkey}
      onHotkeysReset={resetHotkeys}
    />
  );
  const assetsPanel = shouldShowAssetsPanel ? (
    <TimelineWorkbenchAssetsPanel
      className="h-full min-h-0 min-w-0 overflow-auto"
      assets={resolvedAssets}
      tracks={document.tracks as Array<TimelineEditorTrack<Record<string, unknown>, unknown>>}
      selectedTrack={selectedTrack as TimelineEditorTrack<Record<string, unknown>, unknown>}
      readOnly={readOnly}
      acceptedImportTypes={acceptedImportTypes}
      allowUrlImport={allowUrlImport}
      importState={importState}
      renderAsset={renderAsset}
      onImportAssets={onImportAssets ? importAssets : undefined}
      onImportCancel={cancelImport}
      onImportRetry={retryImport}
      onImportStateClear={clearImportState}
      onAssetDragEnd={() => setDraggedAssetId(null)}
      onAssetDragStart={(asset) => setDraggedAssetId(asset.id)}
      onInsertAsset={actions.insertAsset}
    />
  ) : null;
  const inspectorPanel = showInspectorPanel ? (
    <div
      data-slot="timeline-workbench-inspector"
      className="h-full min-h-0 min-w-0 overflow-auto p-0"
    >
      {renderInspector ? (
        renderInspector(inspectorContext)
      ) : (
        <DefaultTimelineInspector
          context={inspectorContext}
          extensionSections={extensionInspectorSections}
          inspectorSchema={inspectorSchema}
          timingStepMs={resolvedSnapMs > 0 ? resolvedSnapMs : undefined}
        />
      )}
    </div>
  ) : null;
  const previewPanel = showPreviewPanel ? (
    <TimelineWorkbenchPreview
      currentTimeMs={currentTimeMs}
      document={document}
      durationMs={durationMs}
      extensions={extensions}
      loopRange={transportLoopRange}
      mode={resolvedPreviewMode}
      readOnly={readOnly}
      selectedItems={selectedItems}
      transport={previewTransportContext}
      onModeChange={commitPreviewMode}
    />
  ) : null;
  const canvasPanel = (
    <>
      <TimelineWorkbenchTransport
        currentTimeMs={currentTimeMs}
        durationMs={durationMs}
        frameStepMs={frameStepMs}
        timeMode={resolvedTimeMode}
        loopRange={transportLoopRange}
        readOnly={readOnly}
        transportState={resolvedTransportState}
        onJumpEnd={() => actions.jumpCurrentTime(durationMs)}
        onJumpStart={() => actions.jumpCurrentTime(0)}
        onNextFrame={() => actions.stepCurrentTimeByFrame(1)}
        onPreviousFrame={() => actions.stepCurrentTimeByFrame(-1)}
        onShuttleBackward={shuttleBackward}
        onShuttleForward={shuttleForward}
        onToggleLoop={toggleLoop}
        onTogglePlay={toggleTransport}
      />
      <TimelineWorkbenchCanvas
        assets={resolvedAssets}
        draggedAssetId={draggedAssetId}
        document={document}
        editPolicy={editPolicy}
        frameRate={frameRate}
        timeMode={resolvedTimeMode}
        hotkeys={resolvedHotkeys}
        getItemContextMenuItems={getWorkbenchItemContextMenuItems}
        getTimelineContextMenuItems={
          hasTimelineContextMenuItems ? getWorkbenchTimelineContextMenuItems : undefined
        }
        getTrackGroupContextMenuItems={getWorkbenchTrackGroupContextMenuItems}
        getTrackContextMenuItems={getWorkbenchTrackContextMenuItems}
        readOnly={readOnly}
        tool={resolvedTool}
        minPixelsPerSecond={minPixelsPerSecond}
        minItemDurationMs={minItemDurationMs}
        renderTimelineItem={renderResolvedTimelineItem}
        renderTrackGroupHeader={renderTrackGroupHeader}
        snap={resolvedSnap}
        resolvedSelection={resolvedSelection}
        resolvedSnapMs={resolvedSnapMs}
        resolvedViewport={resolvedViewport}
        virtualization={virtualization}
        trackGroupMenuItems={trackGroupMenuItems}
        trackKinds={trackKinds}
        formatTrackKind={formatTimelineWorkbenchTrackKind}
        followCurrentTime={resolvedTransportState.status === "playing" ? "keep-visible" : "off"}
        onAddTrack={actions.addTrack}
        onCurrentTimeChange={onCurrentTimeChange}
        onDocumentChange={commitDocument}
        onDropAsset={actions.insertAssetAt}
        onSelectionChange={commitSelection}
        onViewportChange={commitViewport}
      />
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </>
  );

  return (
    <TimelineWorkbenchShellLayout
      className={className}
      style={style}
      toolbar={toolbarContent}
      assetsPanel={assetsPanel}
      inspectorPanel={inspectorPanel}
      previewPanel={previewPanel}
      canvasPanel={canvasPanel}
      onKeyDown={handleWorkbenchKeyDown}
    />
  );
}
