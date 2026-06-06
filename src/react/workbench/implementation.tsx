"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useControllableEditorState } from "@moritzbrantner/editor-core/react";

import {
  Button,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  type MenuActionItem,
  WorkbenchCanvas,
  WorkbenchPanel,
  WorkbenchToolbar,
  cn,
} from "@moritzbrantner/ui";

import {
  canPlaceTimelineEditorItemOnTrack,
  createTimelineEditorClipboard,
  detectTimelineEditorOverlaps,
  formatTimelineEditorTimeMs,
  getTimelineEditorDurationMs,
  getTimelineEditorFrameDurationMs,
  getTimelineEditorFrameDurationMsForMode,
  getTimelineEditorItemEndMs,
  normalizeTimelineEditorDocument,
  resolveTimelineEditorTimeMode,
  setTimelineEditorCurrentTime,
  type TimelineEditorDocument,
  type TimelineEditorClipboard,
  type TimelineEditorItem,
  type TimelineEditorItemKind,
  type TimelineEditorMarker,
  type TimelineEditorSelection,
  type TimelineEditorSnapOptions,
  type TimelineEditorTimeRange,
  type TimelineEditorTool,
  type TimelineEditorTrack,
  type TimelineEditorTrackGroup,
  type TimelineEditorTransformPoint,
  type TimelineEditorTransformPointPatch,
  type TimelineEditorTransformValues,
  type TimelineEditorViewport,
} from "../../core";
import type { TimelineEditorCommand } from "../../commands";
import {
  applyTimelineEditorCommandWithHistory,
  createTimelineEditorHistory,
  redoTimelineEditorHistory,
  undoTimelineEditorHistory,
  type TimelineEditorHistory,
} from "../../history";
import { isKeyboardEventFromEditableTarget, matchesHotkey } from "../timeline-editor/hotkeys";
import type {
  TimelineEditorItemContextMenuContext,
  TimelineEditorItemRenderContext,
  TimelineEditorTimelineContextMenuContext,
  TimelineEditorTrackContextMenuContext,
  TimelineEditorTrackGroupContextMenuContext,
} from "../timeline-editor/types";
import type { TimelineWorkbenchHotkeyId } from "./hotkeys";
import {
  canPlaceTimelineWorkbenchAssetOnTrack,
  createTimelineWorkbenchItemFromAsset,
  TimelineWorkbenchAssetsPanel,
} from "./assets";
import { TimelineWorkbenchCanvas } from "./canvas";
import { getTimelineWorkbenchContextMenuItems } from "./context-menu";
import {
  createTimelineWorkbenchMarkerId,
  createTimelineWorkbenchTrack,
  createTimelineWorkbenchTrackGroupId,
  formatTimelineWorkbenchTrackKind,
} from "./ids";
import { DefaultTimelineInspector } from "./inspector";
import {
  createTimelineWorkbenchItemLookup,
  createTimelineWorkbenchTrackLookup,
  getTimelineWorkbenchSelectedItems,
  getTimelineWorkbenchSelectionPayload,
} from "./selection";
import { TimelineWorkbenchToolbar, defaultTimelineWorkbenchHotkeys } from "./toolbar";
import { TimelineWorkbenchPreview } from "./preview";
import { TimelineWorkbenchTransport } from "./transport";
import {
  getTimelineWorkbenchTransportLoopRange,
  resolveTimelineWorkbenchPlaybackTime,
  resolveTimelineWorkbenchTransportState,
} from "./transport-state";
import { getTimelineWorkbenchToolHotkey } from "./use-workbench-hotkeys";
import {
  areTimelineWorkbenchSelectionsEqual,
  getTimelineWorkbenchImportErrorMessage,
  getTimelineWorkbenchImportSourceLabel,
  getTimelineWorkbenchItemRenderExtension,
  getTimelineWorkbenchTrackKinds,
  isTimelineWorkbenchCurrentTimeOnlyChange,
  isTimelineWorkbenchTrackLocked,
  normalizeTimelineWorkbenchRange,
  selectionForItemIds,
  uniquifyTimelineWorkbenchImportedAssets,
} from "./use-workbench-state";
import type {
  TimelineWorkbenchAsset,
  TimelineWorkbenchImportSource,
  TimelineWorkbenchImportState,
  TimelineWorkbenchInspectorContext,
  TimelinePreviewTransportContext,
  TimelineWorkbenchPlaybackRate,
  TimelineWorkbenchPreviewMode,
  TimelineWorkbenchProps,
  TimelineWorkbenchTransportChangeReason,
  TimelineWorkbenchTransportState,
  TimelineWorkbenchTimelineContextMenuContext,
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
  const [internalTransportState, setInternalTransportState] =
    useState<TimelineWorkbenchTransportState>(() =>
      resolveTimelineWorkbenchTransportState(defaultTransportState),
    );
  const previewAnimationFrameRef = useRef<number | null>(null);
  const previewLastFrameTimestampRef = useRef<number | null>(null);
  const [importedAssets, setImportedAssets] = useState<Array<TimelineWorkbenchAsset<TAssetData>>>(
    [],
  );
  const [importState, setImportState] = useState<TimelineWorkbenchImportState>({
    status: "idle",
  });
  const importedAssetCleanupsRef = useRef<Array<() => void>>([]);
  const importAbortControllerRef = useRef<AbortController | null>(null);
  const retryImportSourcesRef = useRef<TimelineWorkbenchImportSource[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const resolvedAssets = useMemo(() => assets.concat(importedAssets), [assets, importedAssets]);
  const durationMs = document.durationMs ?? getTimelineEditorDurationMs(document.tracks, 30_000);
  const resolvedTimeMode = resolveTimelineEditorTimeMode(timeMode, frameRate);
  const frameDurationMs = getTimelineEditorFrameDurationMsForMode(resolvedTimeMode, frameRate);
  const frameSlotDurationMs = getTimelineEditorFrameDurationMs(frameRate);
  const resolvedSnapMs = frameSlotDurationMs ?? snapMs;
  const currentTimeMs = document.currentTimeMs ?? 0;
  const frameStepMs = frameSlotDurationMs ?? resolvedSnapMs;
  const resolvedTransportState = transportState ?? internalTransportState;
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
  const itemLookup = useMemo(() => createTimelineWorkbenchItemLookup(document), [document]);
  const trackLookup = useMemo(() => createTimelineWorkbenchTrackLookup(document), [document]);
  const selectedItems = getTimelineWorkbenchSelectedItems(resolvedSelection, itemLookup);
  const selected = resolvedSelection.itemIds[0]
    ? itemLookup.get(resolvedSelection.itemIds[0])
    : undefined;
  const selectedItem = selected?.item;
  const selectedTrack =
    (resolvedSelection.trackIds?.[0]
      ? trackLookup.get(resolvedSelection.trackIds[0])
      : undefined) ?? selected?.track;
  const hasItemGroup = (itemIds: string[]) =>
    itemIds.some((itemId) => Boolean(itemLookup.get(itemId)?.item.itemGroupId));
  const hasSelectedItemGroup = hasItemGroup(resolvedSelection.itemIds);
  const overlaps = useMemo(() => detectTimelineEditorOverlaps(document.tracks), [document.tracks]);
  const extensionItems = useMemo(
    () =>
      extensions.filter(
        (extension) =>
          (extension.itemKinds && extension.itemKinds.length > 0) ||
          (extension.domains && extension.domains.length > 0) ||
          (extension.mediaTypes && extension.mediaTypes.length > 0) ||
          Boolean(extension.matchItem),
      ),
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

  const documentRef = useRef(document);
  const durationMsRef = useRef(durationMs);
  const onCurrentTimeChangeRef = useRef(onCurrentTimeChange);
  const commitDocumentRef = useRef(commitDocument);
  const resolvedSelectionRef = useRef(resolvedSelection);
  const transportStateRef = useRef(resolvedTransportState);
  const onTransportStateChangeRef = useRef(onTransportStateChange);

  useEffect(() => {
    documentRef.current = document;
    durationMsRef.current = durationMs;
    onCurrentTimeChangeRef.current = onCurrentTimeChange;
    commitDocumentRef.current = commitDocument;
    resolvedSelectionRef.current = resolvedSelection;
    transportStateRef.current = resolvedTransportState;
    onTransportStateChangeRef.current = onTransportStateChange;
  });

  const cancelPreviewAnimationFrame = useCallback(() => {
    if (previewAnimationFrameRef.current !== null) {
      cancelAnimationFrame(previewAnimationFrameRef.current);
      previewAnimationFrameRef.current = null;
    }

    previewLastFrameTimestampRef.current = null;
  }, []);

  const commitPreviewCurrentTime = useCallback((timeMs: number) => {
    const currentDocument = documentRef.current;
    const nextDocument = setTimelineEditorCurrentTime(currentDocument, timeMs, {
      durationMs: durationMsRef.current,
      snapMs: 0,
    });

    onCurrentTimeChangeRef.current?.(nextDocument.currentTimeMs ?? 0);
    commitDocumentRef.current(nextDocument);
  }, []);

  const commitTransportState = useCallback(
    (
      nextState: TimelineWorkbenchTransportState,
      reason: TimelineWorkbenchTransportChangeReason,
    ) => {
      const resolvedNextState = resolveTimelineWorkbenchTransportState(nextState);

      transportStateRef.current = resolvedNextState;
      if (transportState === undefined) {
        setInternalTransportState(resolvedNextState);
      }

      onTransportStateChangeRef.current?.(resolvedNextState, {
        reason,
        currentTimeMs: documentRef.current.currentTimeMs ?? 0,
        durationMs: durationMsRef.current,
      });
    },
    [transportState],
  );

  const pauseTransport = useCallback(
    (reason: TimelineWorkbenchTransportChangeReason = "pause") => {
      commitTransportState({ ...transportStateRef.current, status: "paused" }, reason);
      cancelPreviewAnimationFrame();
    },
    [cancelPreviewAnimationFrame, commitTransportState],
  );

  const playTransport = useCallback(
    (
      rate: TimelineWorkbenchPlaybackRate = 1,
      reason: TimelineWorkbenchTransportChangeReason = "play",
    ) => {
      if (readOnly || durationMsRef.current <= 0) {
        return;
      }

      const duration = durationMsRef.current;
      const currentTime = documentRef.current.currentTimeMs ?? 0;
      const loopRange = getTimelineWorkbenchTransportLoopRange(
        transportStateRef.current.loop,
        resolvedSelectionRef.current.range,
        duration,
      );

      if (loopRange) {
        if (rate > 0 && currentTime >= loopRange.endMs) {
          commitPreviewCurrentTime(loopRange.startMs);
        } else if (rate < 0 && currentTime <= loopRange.startMs) {
          commitPreviewCurrentTime(loopRange.endMs);
        }
      } else if (rate > 0 && currentTime >= duration) {
        commitPreviewCurrentTime(0);
      } else if (rate < 0 && currentTime <= 0) {
        commitPreviewCurrentTime(duration);
      }

      previewLastFrameTimestampRef.current = null;
      commitTransportState(
        {
          ...transportStateRef.current,
          status: "playing",
          playbackRate: rate,
        },
        reason,
      );
    },
    [commitPreviewCurrentTime, commitTransportState, readOnly],
  );

  const toggleTransport = useCallback(() => {
    if (transportStateRef.current.status === "playing") {
      pauseTransport("toggle-play");
    } else {
      playTransport(1, "toggle-play");
    }
  }, [pauseTransport, playTransport]);

  const stopTransport = useCallback(() => {
    commitTransportState(
      { ...transportStateRef.current, status: "paused", playbackRate: 1 },
      "stop",
    );
    cancelPreviewAnimationFrame();
  }, [cancelPreviewAnimationFrame, commitTransportState]);

  const shuttleForward = useCallback(() => {
    const currentState = transportStateRef.current;
    const nextRate: TimelineWorkbenchPlaybackRate =
      currentState.status === "paused" || currentState.playbackRate < 0
        ? 1
        : currentState.playbackRate === 1
          ? 2
          : 4;

    playTransport(nextRate, "shuttle-forward");
  }, [playTransport]);

  const shuttleBackward = useCallback(() => {
    const currentState = transportStateRef.current;
    const nextRate: TimelineWorkbenchPlaybackRate =
      currentState.status === "paused" || currentState.playbackRate > 0
        ? -1
        : currentState.playbackRate === -1
          ? -2
          : -4;

    playTransport(nextRate, "shuttle-backward");
  }, [playTransport]);

  const toggleLoop = useCallback(() => {
    if (readOnly || durationMsRef.current <= 0) {
      return;
    }

    commitTransportState(
      { ...transportStateRef.current, loop: !transportStateRef.current.loop },
      "loop-toggle",
    );
  }, [commitTransportState, readOnly]);

  useEffect(() => {
    if (resolvedTransportState.status !== "playing") {
      cancelPreviewAnimationFrame();
      return;
    }

    if (durationMs <= 0) {
      pauseTransport("ended");
      return;
    }

    const tick = (timestamp: number) => {
      const lastTimestamp = previewLastFrameTimestampRef.current;
      previewLastFrameTimestampRef.current = timestamp;

      if (lastTimestamp !== null) {
        const duration = durationMsRef.current;
        const state = transportStateRef.current;

        if (duration <= 0) {
          pauseTransport("ended");
          return;
        }

        const currentTime = documentRef.current.currentTimeMs ?? 0;
        const elapsedMs = timestamp - lastTimestamp;
        const nextTime = currentTime + elapsedMs * state.playbackRate;
        const loopRange = getTimelineWorkbenchTransportLoopRange(
          state.loop,
          resolvedSelectionRef.current.range,
          duration,
        );
        const resolvedTime = resolveTimelineWorkbenchPlaybackTime(
          nextTime,
          duration,
          state.playbackRate,
          loopRange,
        );

        commitPreviewCurrentTime(resolvedTime.timeMs);

        if (resolvedTime.ended) {
          commitTransportState({ ...state, status: "paused" }, "ended");
          previewAnimationFrameRef.current = null;
          previewLastFrameTimestampRef.current = null;
          return;
        }
      }

      previewAnimationFrameRef.current = requestAnimationFrame(tick);
    };

    previewAnimationFrameRef.current = requestAnimationFrame(tick);

    return cancelPreviewAnimationFrame;
  }, [
    cancelPreviewAnimationFrame,
    commitPreviewCurrentTime,
    commitTransportState,
    durationMs,
    pauseTransport,
    resolvedTransportState.status,
  ]);

  useEffect(() => {
    if (resolvedTransportState.status === "playing" && readOnly) {
      pauseTransport("read-only");
    }
  }, [pauseTransport, readOnly, resolvedTransportState.status]);

  useEffect(() => {
    if (resolvedTransportState.status === "playing" && durationMs <= 0) {
      pauseTransport("ended");
    }
  }, [durationMs, pauseTransport, resolvedTransportState.status]);

  useEffect(
    () => () => {
      importAbortControllerRef.current?.abort();
      importAbortControllerRef.current = null;
      const cleanups = importedAssetCleanupsRef.current;
      importedAssetCleanupsRef.current = [];

      for (const cleanup of cleanups) {
        cleanup();
      }
    },
    [],
  );

  const previousDocumentRef = useRef(document);

  useEffect(() => {
    const previousDocument = previousDocumentRef.current;
    previousDocumentRef.current = document;

    if (
      resolvedTransportState.status === "playing" &&
      previousDocument !== document &&
      !isTimelineWorkbenchCurrentTimeOnlyChange(previousDocument, document)
    ) {
      pauseTransport("document-change");
    }
  }, [document, pauseTransport, resolvedTransportState.status]);

  const runCommand = (
    command: TimelineEditorCommand<TTrackData, TItemData>,
    commandSelection = resolvedSelection,
  ) => {
    const result = applyTimelineEditorCommandWithHistory(
      document,
      commandSelection,
      resolvedHistory,
      command,
      { durationMs, editPolicy, snapMs: resolvedSnapMs, minItemDurationMs },
    );

    commitHistory(result.history);

    if ("clipboard" in result) {
      commitClipboard(result.clipboard);
    }

    if (result.changed) {
      onDocumentChange?.(result.document);
    }

    if (!areTimelineWorkbenchSelectionsEqual(result.selection, resolvedSelection)) {
      commitSelection(result.selection);
    }
  };

  const runTransientCommand = (
    command: TimelineEditorCommand<TTrackData, TItemData>,
    commandSelection = resolvedSelection,
  ) => {
    const result = applyTimelineEditorCommandWithHistory(
      document,
      commandSelection,
      resolvedHistory,
      command,
      { durationMs, editPolicy, snapMs: resolvedSnapMs, minItemDurationMs },
    );

    if ("clipboard" in result) {
      commitClipboard(result.clipboard);
    }

    if (result.changed) {
      commitHistory(result.history);
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

  const copyItems = (itemIds = resolvedSelection.itemIds) => {
    if (itemIds.length === 0) {
      return;
    }

    const nextClipboard = createTimelineEditorClipboard(document.tracks, itemIds);
    commitClipboard(nextClipboard);
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

  const importAssets = async (sources: TimelineWorkbenchImportSource[]) => {
    if (readOnly || sources.length === 0) {
      return;
    }

    retryImportSourcesRef.current = sources;
    const sourceLabel = getTimelineWorkbenchImportSourceLabel(sources);
    const sourceStates = sources.map((source, index) => ({
      id: getTimelineWorkbenchImportSourceStateId(source, index),
      label: source.label ?? source.file?.name ?? source.url ?? `Source ${index + 1}`,
      status: "pending" as const,
      metadata: isTimelineWorkbenchImportSourceMetadata(source.metadata)
        ? source.metadata
        : undefined,
    }));

    if (!onImportAssets) {
      setImportState({
        status: "failed",
        sourceLabel,
        error: "Import is not configured for this workbench.",
        sources: sourceStates.map((source) => ({
          ...source,
          status: "failed",
          error: "Import is not configured for this workbench.",
        })),
      });
      return;
    }

    importAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    importAbortControllerRef.current = abortController;

    setImportState({ status: "importing", sourceLabel, sources: sourceStates, canCancel: true });

    try {
      const results = await onImportAssets(sources, {
        signal: abortController.signal,
        onProgress(sourceId, progress) {
          setImportState((currentState) =>
            updateTimelineWorkbenchImportSourceState(currentState, sourceId, {
              progress,
              status: "importing",
            }),
          );
        },
        onWarning(sourceId, warning) {
          setImportState((currentState) =>
            updateTimelineWorkbenchImportSourceWarning(currentState, sourceId, warning),
          );
        },
      });

      if (abortController.signal.aborted) {
        setImportState({
          status: "cancelled",
          sourceLabel,
          sources: sourceStates.map((source) => ({ ...source, status: "cancelled" })),
          canCancel: false,
        });
        return;
      }

      const resultAssets = results
        .map((result) => result.asset)
        .filter((asset): asset is TimelineWorkbenchAsset<TAssetData> => Boolean(asset));
      const resultCleanups = results
        .map((result) => result.cleanup ?? result.revoke)
        .filter((cleanup): cleanup is () => void => Boolean(cleanup));
      const warnings = results.flatMap((result) => result.warnings ?? []);
      const errors = results.flatMap((result) => result.errors ?? []);

      if (resultAssets.length > 0) {
        importedAssetCleanupsRef.current.push(...resultCleanups);
        setImportedAssets((currentAssets) =>
          currentAssets.concat(
            uniquifyTimelineWorkbenchImportedAssets(assets.concat(currentAssets), resultAssets),
          ),
        );
      }

      setImportState({
        status: resultAssets.length > 0 ? "ready" : "failed",
        sourceLabel,
        warnings: warnings.length > 0 ? warnings : undefined,
        error:
          resultAssets.length === 0
            ? (errors[0] ?? warnings[0] ?? "Import did not return any assets.")
            : undefined,
        sources: sourceStates.map((source, index) => {
          const result = results[index];
          const sourceWarnings = result?.warnings;
          const sourceError = result?.errors?.[0];

          return {
            ...source,
            status: result?.asset ? ("ready" as const) : ("failed" as const),
            warnings: sourceWarnings?.length ? sourceWarnings : undefined,
            error: sourceError,
            metadata: result?.metadata ?? source.metadata,
          };
        }),
        canCancel: false,
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        setImportState({
          status: "cancelled",
          sourceLabel,
          sources: sourceStates.map((source) => ({ ...source, status: "cancelled" })),
          canCancel: false,
        });
        return;
      }

      const errorMessage = getTimelineWorkbenchImportErrorMessage(error);

      setImportState({
        status: "failed",
        sourceLabel,
        error: errorMessage,
        sources: sourceStates.map((source) => ({
          id: source.id,
          label: source.label,
          status: "failed",
          error: errorMessage,
          metadata: source.metadata,
        })),
        canCancel: false,
      });
    } finally {
      if (importAbortControllerRef.current === abortController) {
        importAbortControllerRef.current = null;
      }
    }
  };

  const cancelImport = () => {
    importAbortControllerRef.current?.abort();
    onImportCancel?.();
    setImportState((currentState) =>
      currentState.status === "importing"
        ? {
            ...currentState,
            status: "cancelled",
            canCancel: false,
            sources: currentState.sources?.map((source) =>
              source.status === "ready" || source.status === "failed"
                ? source
                : { ...source, status: "cancelled" },
            ),
          }
        : currentState,
    );
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

  const inspectorContext = {
    document: document as TimelineEditorDocument<TTrackData, TItemData>,
    durationMs,
    readOnly,
    selection: resolvedSelection,
    selectedItem,
    selectedItems,
    selectedTrack: selectedTrack as TimelineEditorTrack<TTrackData, TItemData> | undefined,
    setCurrentTime: (timeMs = currentTimeMs) => jumpCurrentTime(timeMs),
    addMarker,
    updateMarker,
    removeMarker,
    setRange,
    deleteRange,
    insertGap,
    closeGap,
    updateSelectedItem,
    updateSelectedItems,
    updateSelectedTrack,
    removeSelectedTrack,
    selectSelectedTrackItems,
    upsertSelectedTransformPoint,
    updateSelectedTransformPoint,
    moveSelectedTransformPoint,
    removeSelectedTransformPoint,
  } satisfies TimelineWorkbenchInspectorContext<TItemData, TTrackData>;

  const extensionInspectorSections = extensions.flatMap(
    (extension) =>
      extension.inspectorSections?.map((factory) =>
        factory({
          ...inspectorContext,
          selectedTrack: selectedTrack as TimelineEditorTrack<TTrackData, TItemData> | undefined,
        }),
      ) ?? [],
  );

  const renderResolvedTimelineItem = (context: TimelineEditorItemRenderContext<TItemData>) => {
    const extension = getTimelineWorkbenchItemRenderExtension(context.item, extensionItems);

    return extension?.renderItem?.(context) ?? renderTimelineItem?.(context);
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
        .map(
          (group): MenuActionItem => ({
            id: `add-track-to-group-${group.id}`,
            label: `Add Track To ${group.label}`,
            disabled: readOnly || group.trackIds.includes(context.track.id),
            onSelect: () =>
              runCommand({
                type: "add-tracks-to-group",
                groupId: group.id,
                trackIds: [context.track.id],
              }),
          }),
        ),
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

  const commitHotkey = (id: TimelineWorkbenchHotkeyId, hotkey: string) => {
    const nextHotkeys = { ...customHotkeys, [id]: hotkey };
    setCustomHotkeys(nextHotkeys);
    onHotkeysChange?.(nextHotkeys);
  };

  const resetHotkeys = () => {
    setCustomHotkeys({});
    onHotkeysChange?.({});
  };

  const stepCurrentTimeByFrame = (direction: -1 | 1) => {
    if (readOnly || frameStepMs <= 0) {
      return;
    }

    if (transportStateRef.current.status === "playing") {
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
    const extensionItems = extensions.flatMap(
      (extension) => extension.timelineContextMenuItems?.(workbenchContext) ?? [],
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
    const extraItems =
      consumerItems.length > 0 && extensionItems.length > 0
        ? [
            ...consumerItems,
            { id: "timeline-actions-separator", type: "separator" as const },
            ...extensionItems,
          ]
        : [...consumerItems, ...extensionItems];

    return extraItems.length > 0
      ? [...builtInItems, { id: "timeline-extra-separator", type: "separator" }, ...extraItems]
      : builtInItems;
  };

  const handleWorkbenchKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) {
      return;
    }

    if (isKeyboardEventFromEditableTarget(event)) {
      return;
    }

    if (readOnly && !(resolvedHotkeys.copy && matchesHotkey(event, resolvedHotkeys.copy))) {
      return;
    }

    if (!readOnly && resolvedHotkeys.playPause && matchesHotkey(event, resolvedHotkeys.playPause)) {
      event.preventDefault();
      toggleTransport();
      return;
    }

    if (
      !readOnly &&
      resolvedHotkeys.stopPlayback &&
      matchesHotkey(event, resolvedHotkeys.stopPlayback)
    ) {
      event.preventDefault();
      stopTransport();
      return;
    }

    if (
      !readOnly &&
      resolvedHotkeys.shuttleForward &&
      matchesHotkey(event, resolvedHotkeys.shuttleForward)
    ) {
      event.preventDefault();
      shuttleForward();
      return;
    }

    if (
      !readOnly &&
      resolvedHotkeys.shuttleBackward &&
      matchesHotkey(event, resolvedHotkeys.shuttleBackward)
    ) {
      event.preventDefault();
      shuttleBackward();
      return;
    }

    if (
      !readOnly &&
      resolvedHotkeys.toggleLoop &&
      matchesHotkey(event, resolvedHotkeys.toggleLoop)
    ) {
      event.preventDefault();
      toggleLoop();
      return;
    }

    if (resolvedHotkeys.undo && matchesHotkey(event, resolvedHotkeys.undo)) {
      event.preventDefault();
      const undo = undoTimelineEditorHistory(resolvedHistory);
      commitHistory(undo.history);
      if (undo.document) {
        onDocumentChange?.(undo.document);
        if (undo.selection) {
          commitSelection(undo.selection);
        }
      }
      return;
    }

    if (
      (resolvedHotkeys.redo && matchesHotkey(event, resolvedHotkeys.redo)) ||
      (resolvedHotkeys.redoAlternate && matchesHotkey(event, resolvedHotkeys.redoAlternate))
    ) {
      event.preventDefault();
      const redo = redoTimelineEditorHistory(resolvedHistory);
      commitHistory(redo.history);
      if (redo.document) {
        onDocumentChange?.(redo.document);
        if (redo.selection) {
          commitSelection(redo.selection);
        }
      }
      return;
    }

    if (
      (resolvedHotkeys.delete && matchesHotkey(event, resolvedHotkeys.delete)) ||
      event.key === "Backspace"
    ) {
      event.preventDefault();
      deleteItems();
      return;
    }

    if (resolvedHotkeys.copy && matchesHotkey(event, resolvedHotkeys.copy)) {
      event.preventDefault();
      copyItems();
      return;
    }

    if (resolvedHotkeys.cut && matchesHotkey(event, resolvedHotkeys.cut)) {
      event.preventDefault();
      cutItems();
      return;
    }

    if (resolvedHotkeys.paste && matchesHotkey(event, resolvedHotkeys.paste)) {
      event.preventDefault();
      pasteItems();
      return;
    }

    if (resolvedHotkeys.split && matchesHotkey(event, resolvedHotkeys.split)) {
      event.preventDefault();
      splitItems();
      return;
    }

    if (resolvedHotkeys.duplicate && matchesHotkey(event, resolvedHotkeys.duplicate)) {
      event.preventDefault();
      duplicateItems();
      return;
    }

    if (resolvedHotkeys.group && matchesHotkey(event, resolvedHotkeys.group)) {
      event.preventDefault();
      groupItems();
      return;
    }

    if (resolvedHotkeys.ungroup && matchesHotkey(event, resolvedHotkeys.ungroup)) {
      event.preventDefault();
      ungroupItems();
      return;
    }

    if (resolvedHotkeys.addMarker && matchesHotkey(event, resolvedHotkeys.addMarker)) {
      event.preventDefault();
      addMarker();
      return;
    }

    if (resolvedHotkeys.clearSelection && matchesHotkey(event, resolvedHotkeys.clearSelection)) {
      event.preventDefault();
      runTransientCommand({ type: "clear-selection" });
      return;
    }

    if (resolvedHotkeys.previousFrame && matchesHotkey(event, resolvedHotkeys.previousFrame)) {
      event.preventDefault();
      stepCurrentTimeByFrame(-1);
      return;
    }

    if (resolvedHotkeys.nextFrame && matchesHotkey(event, resolvedHotkeys.nextFrame)) {
      event.preventDefault();
      stepCurrentTimeByFrame(1);
      return;
    }

    if (resolvedHotkeys.jumpStart && matchesHotkey(event, resolvedHotkeys.jumpStart)) {
      event.preventDefault();
      jumpCurrentTime(0);
      return;
    }

    if (resolvedHotkeys.jumpEnd && matchesHotkey(event, resolvedHotkeys.jumpEnd)) {
      event.preventDefault();
      jumpCurrentTime(durationMs);
      return;
    }

    if (resolvedHotkeys.previousMarker && matchesHotkey(event, resolvedHotkeys.previousMarker)) {
      event.preventDefault();
      jumpToAdjacentMarker(-1);
      return;
    }

    if (resolvedHotkeys.nextMarker && matchesHotkey(event, resolvedHotkeys.nextMarker)) {
      event.preventDefault();
      jumpToAdjacentMarker(1);
      return;
    }

    if (resolvedHotkeys.previousEdge && matchesHotkey(event, resolvedHotkeys.previousEdge)) {
      event.preventDefault();
      jumpToAdjacentItemEdge(-1);
      return;
    }

    if (resolvedHotkeys.nextEdge && matchesHotkey(event, resolvedHotkeys.nextEdge)) {
      event.preventDefault();
      jumpToAdjacentItemEdge(1);
      return;
    }

    const nextTool = getTimelineWorkbenchToolHotkey(event, resolvedHotkeys);

    if (nextTool) {
      event.preventDefault();
      commitTool(nextTool);
    }
  };

  const renderTrackGroupHeader = (context: {
    group: TimelineEditorTrackGroup;
    locked: boolean;
  }) => (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="truncate">{context.group.label}</div>
        <div className="text-[10px] font-normal text-muted-foreground">
          {context.group.trackIds.length} tracks
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="xs"
          variant="ghost"
          disabled={readOnly}
          onClick={(event) => {
            event.stopPropagation();
            updateTrackGroup(context.group.id, { collapsed: !context.group.collapsed });
          }}
        >
          {context.group.collapsed ? "Expand" : "Collapse"}
        </Button>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          disabled={readOnly}
          onClick={(event) => {
            event.stopPropagation();
            updateTrackGroup(context.group.id, { locked: !context.group.locked });
          }}
        >
          {context.locked ? "Unlock" : "Lock"}
        </Button>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          disabled={readOnly}
          onClick={(event) => {
            event.stopPropagation();
            renameTrackGroup(context.group.id);
          }}
        >
          Rename
        </Button>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          disabled={readOnly}
          onClick={(event) => {
            event.stopPropagation();
            removeTrackGroup(context.group.id);
          }}
        >
          Dissolve
        </Button>
      </div>
    </div>
  );
  const announce = (message: string) => {
    setAnnouncement(message);
  };
  const shouldShowAssetsPanel =
    showAssetsPanel && (resolvedAssets.length > 0 || Boolean(onImportAssets));
  const transportLoopRange = getTimelineWorkbenchTransportLoopRange(
    resolvedTransportState.loop,
    resolvedSelection.range,
    durationMs,
  );
  const previewTransportContext = {
    ...resolvedTransportState,
    currentTimeMs,
    durationMs,
    isPlaying: resolvedTransportState.status === "playing",
    getItemLocalTimeMs: (item: TimelineEditorItem<unknown>) => currentTimeMs - item.startMs,
    isItemActive: (item: TimelineEditorItem<unknown>) =>
      item.startMs <= currentTimeMs && getTimelineEditorItemEndMs(item) >= currentTimeMs,
  } satisfies TimelinePreviewTransportContext;
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
      readOnly={readOnly}
      resolvedHotkeys={resolvedHotkeys}
      resolvedSnap={resolvedSnap}
      resolvedTimeMode={resolvedTimeMode}
      resolvedTool={resolvedTool}
      renderToolbarActions={renderToolbarActions}
      resolvedSelection={resolvedSelection}
      resolvedViewport={resolvedViewport}
      onAddMarker={() => {
        addMarker();
        announce("Marker added");
      }}
      onDelete={() => {
        deleteItems();
        announce("Selection deleted");
      }}
      onDeleteRange={() => {
        deleteRange(resolvedSelection.range);
        announce("Range deleted");
      }}
      onCopy={() => {
        copyItems();
        announce("Selection copied");
      }}
      onCut={() => {
        cutItems();
        announce("Selection cut");
      }}
      onDuplicate={() => {
        duplicateItems();
        announce("Selection duplicated");
      }}
      onGroup={() => {
        groupItems();
        announce("Items grouped");
      }}
      onInsertGap={() => {
        insertSelectedRangeGap();
        announce("Gap inserted");
      }}
      onCloseGap={() => {
        closeSelectedRangeGap();
        announce("Gap closed");
      }}
      onPaste={() => {
        pasteItems();
        announce("Clipboard pasted");
      }}
      onRedo={() => {
        const redo = redoTimelineEditorHistory(resolvedHistory);
        commitHistory(redo.history);
        if (redo.document) {
          onDocumentChange?.(redo.document);
          if (redo.selection) {
            commitSelection(redo.selection);
          }
          announce("Redo applied");
        }
      }}
      onSplit={() => {
        splitItems();
        announce("Selection split");
      }}
      onStepFrame={(direction) => {
        stepCurrentTimeByFrame(direction);
        const stepLabel = resolvedTimeMode === "frames" ? "frame" : "step";
        announce(direction < 0 ? `Moved to previous ${stepLabel}` : `Moved to next ${stepLabel}`);
      }}
      onUndo={() => {
        const undo = undoTimelineEditorHistory(resolvedHistory);
        commitHistory(undo.history);
        if (undo.document) {
          onDocumentChange?.(undo.document);
          if (undo.selection) {
            commitSelection(undo.selection);
          }
          announce("Undo applied");
        }
      }}
      onUngroup={() => {
        ungroupItems();
        announce("Items ungrouped");
      }}
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
      onImportRetry={() => {
        void importAssets(retryImportSourcesRef.current);
      }}
      onImportStateClear={() => setImportState({ status: "idle" })}
      onAssetDragEnd={() => setDraggedAssetId(null)}
      onAssetDragStart={(asset) => setDraggedAssetId(asset.id)}
      onInsertAsset={insertAsset}
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
    <WorkbenchCanvas
      className="grid h-full min-h-0 p-0"
      style={{ gridTemplateRows: "auto minmax(0, 1fr)" }}
    >
      <TimelineWorkbenchTransport
        currentTimeMs={currentTimeMs}
        durationMs={durationMs}
        frameStepMs={frameStepMs}
        timeMode={resolvedTimeMode}
        loopRange={transportLoopRange}
        readOnly={readOnly}
        transportState={resolvedTransportState}
        onJumpEnd={() => jumpCurrentTime(durationMs)}
        onJumpStart={() => jumpCurrentTime(0)}
        onNextFrame={() => stepCurrentTimeByFrame(1)}
        onPreviousFrame={() => stepCurrentTimeByFrame(-1)}
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
        onAddTrack={addTrack}
        onCurrentTimeChange={onCurrentTimeChange}
        onDocumentChange={commitDocument}
        onDropAsset={insertAssetAt}
        onSelectionChange={commitSelection}
        onViewportChange={commitViewport}
      />
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </WorkbenchCanvas>
  );
  const sidePanelsVisible = Boolean(assetsPanel || inspectorPanel);
  const mainPanelDefaultSize = 100 - (assetsPanel ? 20 : 0) - (inspectorPanel ? 24 : 0);
  const renderMainArea = (centerPanel: ReactNode) =>
    sidePanelsVisible ? (
      <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0">
        {assetsPanel ? (
          <>
            <ResizablePanel defaultSize={20} minSize={16} collapsible>
              <WorkbenchPanel side="left" className="h-full min-h-0 border-r-0">
                {assetsPanel}
              </WorkbenchPanel>
            </ResizablePanel>
            <ResizableHandle withHandle />
          </>
        ) : null}
        <ResizablePanel defaultSize={mainPanelDefaultSize} minSize={36}>
          {centerPanel}
        </ResizablePanel>
        {inspectorPanel ? (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={24} minSize={18} collapsible>
              <WorkbenchPanel side="right" className="h-full min-h-0 border-l-0">
                {inspectorPanel}
              </WorkbenchPanel>
            </ResizablePanel>
          </>
        ) : null}
      </ResizablePanelGroup>
    ) : (
      centerPanel
    );
  const previewMainPanel = previewPanel ? (
    <WorkbenchCanvas className="h-full min-h-0 p-0">{previewPanel}</WorkbenchCanvas>
  ) : null;

  return (
    <div
      data-slot="timeline-workbench"
      className={cn(
        "grid min-h-0 w-full overflow-hidden rounded-md border border-border/60 bg-background text-foreground",
        className,
      )}
      style={{
        gridTemplateRows: "auto minmax(0, 1fr)",
        height: "100%",
        minHeight: "34rem",
        ...style,
      }}
      onKeyDown={handleWorkbenchKeyDown}
    >
      <WorkbenchToolbar>{toolbarContent}</WorkbenchToolbar>
      <ResizablePanelGroup orientation="vertical" className="min-h-0">
        <ResizablePanel
          defaultSize={previewMainPanel ? 28 : 100}
          minSize={previewMainPanel ? 18 : 42}
        >
          {previewMainPanel ? renderMainArea(previewMainPanel) : renderMainArea(canvasPanel)}
        </ResizablePanel>
        {previewMainPanel ? (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={72} minSize={42}>
              {canvasPanel}
            </ResizablePanel>
          </>
        ) : null}
      </ResizablePanelGroup>
    </div>
  );
}

function getTimelineWorkbenchImportSourceStateId(
  source: TimelineWorkbenchImportSource,
  index: number,
) {
  return source.label ?? source.file?.name ?? source.url ?? `source-${index + 1}`;
}

function updateTimelineWorkbenchImportSourceState(
  state: TimelineWorkbenchImportState,
  sourceId: string,
  patch: Partial<NonNullable<TimelineWorkbenchImportState["sources"]>[number]>,
): TimelineWorkbenchImportState {
  const sources = state.sources?.map((source) =>
    source.id === sourceId ? { ...source, ...patch } : source,
  );

  return {
    ...state,
    progress: patch.progress ?? state.progress,
    sources,
  };
}

function updateTimelineWorkbenchImportSourceWarning(
  state: TimelineWorkbenchImportState,
  sourceId: string,
  warning: string,
): TimelineWorkbenchImportState {
  const sources = state.sources?.map((source) =>
    source.id === sourceId
      ? { ...source, warnings: [...(source.warnings ?? []), warning] }
      : source,
  );

  return {
    ...state,
    warnings: [...(state.warnings ?? []), warning],
    sources,
  };
}

function isTimelineWorkbenchImportSourceMetadata(
  metadata: unknown,
): metadata is Record<string, unknown> {
  return Boolean(metadata && typeof metadata === "object" && !Array.isArray(metadata));
}
