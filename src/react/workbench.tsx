"use client";

import { useMemo, useState } from "react";

import { type MenuActionItem, WorkbenchPanel, cn } from "@moritzbrantner/ui";

import {
  canPlaceTimelineEditorItemOnTrack,
  createTimelineEditorClipboard,
  detectTimelineEditorOverlaps,
  formatTimelineEditorTimeMs,
  getTimelineEditorDurationMs,
  getTimelineEditorFrameDurationMs,
  getTimelineEditorItemEndMs,
  normalizeTimelineEditorDocument,
  setTimelineEditorCurrentTime,
  type TimelineEditorDocument,
  type TimelineEditorClipboard,
  type TimelineEditorItem,
  type TimelineEditorItemKind,
  type TimelineEditorSelection,
  type TimelineEditorTool,
  type TimelineEditorTrack,
  type TimelineEditorTrackGroup,
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
import { isKeyboardEventFromEditableTarget, matchesHotkey } from "./timeline-editor/hotkeys";
import type {
  TimelineEditorItemContextMenuContext,
  TimelineEditorItemRenderContext,
  TimelineEditorTrackContextMenuContext,
} from "./timeline-editor";
import type { TimelineWorkbenchHotkeyId } from "./workbench/hotkeys";
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
  createTimelineWorkbenchTrackGroupId,
  formatTimelineWorkbenchTrackKind,
} from "./workbench/ids";
import { DefaultTimelineInspector } from "./workbench/inspector";
import {
  createTimelineWorkbenchItemLookup,
  getTimelineWorkbenchSelectedItems,
  getTimelineWorkbenchSelectionPayload,
} from "./workbench/selection";
import { TimelineWorkbenchToolbar, defaultTimelineWorkbenchHotkeys } from "./workbench/toolbar";
import { TimelineWorkbenchPreview } from "./workbench/preview";
import type {
  TimelineEditorExtension,
  TimelineWorkbenchAsset,
  TimelineWorkbenchInspectorContext,
  TimelineWorkbenchProps,
} from "./workbench/types";

export { defaultTimelineWorkbenchHotkeys } from "./workbench/toolbar";
export type {
  TimelineWorkbenchAsset,
  TimelineEditorExtension,
  TimelineWorkbenchInspectorContext,
  TimelineWorkbenchInspectorSchema,
  TimelineWorkbenchItemContextMenuContext,
  TimelineWorkbenchProps,
  TimelineWorkbenchSelection,
  TimelinePreviewContext,
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
  snap,
  minItemDurationMs,
  tool,
  onToolChange,
  virtualization,
  clipboard,
  onClipboardChange,
  hotkeys,
  onHotkeysChange,
  extensions = [],
  inspectorSchema,
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
  const [internalClipboard, setInternalClipboard] = useState<
    TimelineEditorClipboard<TItemData> | undefined
  >();
  const [internalTool, setInternalTool] = useState<TimelineEditorTool>(tool ?? "select");
  const [customHotkeys, setCustomHotkeys] = useState<
    Partial<typeof defaultTimelineWorkbenchHotkeys>
  >({});
  const [draggedAssetId, setDraggedAssetId] = useState<string | null>(null);
  const resolvedViewport = viewport ?? internalViewport;
  const durationMs = document.durationMs ?? getTimelineEditorDurationMs(document.tracks, 30_000);
  const frameDurationMs = getTimelineEditorFrameDurationMs(frameRate);
  const resolvedSnapMs = frameDurationMs ?? snapMs;
  const currentTimeMs = document.currentTimeMs ?? 0;
  const frameStepMs = frameDurationMs ?? resolvedSnapMs;
  const resolvedTool = tool ?? internalTool;
  const resolvedHotkeys = { ...defaultTimelineWorkbenchHotkeys, ...hotkeys, ...customHotkeys };
  const resolvedClipboard = clipboard ?? internalClipboard;
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
  const extensionItems = useMemo(
    () => extensions.filter((extension) => extension.itemKinds && extension.itemKinds.length > 0),
    [extensions],
  );
  const trackKinds = useMemo(
    () => getTimelineWorkbenchTrackKinds(document.tracks, assets, extensions),
    [assets, document.tracks, extensions],
  );

  const commitSelection = (nextSelection: TimelineEditorSelection) => {
    onSelectionChange?.(nextSelection);
    onSelectedItemChange?.(getTimelineWorkbenchSelectionPayload(nextSelection, itemLookup));
  };

  const commitDocument = (nextDocument: TimelineEditorDocument<TTrackData, TItemData>) => {
    if (
      nextDocument !== document &&
      !isTimelineWorkbenchCurrentTimeOnlyChange(document, nextDocument)
    ) {
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

  const commitClipboard = (nextClipboard: TimelineEditorClipboard<TItemData> | undefined) => {
    if (!clipboard) {
      setInternalClipboard(nextClipboard);
    }

    onClipboardChange?.(nextClipboard);
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
      { durationMs, editPolicy, snapMs: resolvedSnapMs, minItemDurationMs },
    );

    setHistory(result.history);

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
      history,
      command,
      { durationMs, editPolicy, snapMs: resolvedSnapMs, minItemDurationMs },
    );

    if ("clipboard" in result) {
      commitClipboard(result.clipboard);
    }

    if (result.changed) {
      setHistory(result.history);
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
      if (track.locked || !track.items.some((item) => selectedItemIds.has(item.id))) {
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

  const addMarker = () => {
    if (readOnly) {
      return;
    }

    const marker = {
      id: createTimelineWorkbenchMarkerId(currentTimeMs, createMarkerId),
      timeMs: currentTimeMs,
      label: formatTimelineEditorTimeMs(currentTimeMs),
    };
    runCommand({ type: "add-marker", marker });
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

    const trackIds = [...group.trackIds];
    const [movedTrackId] = trackIds.splice(currentIndex, 1);

    if (!movedTrackId) {
      return;
    }

    trackIds.splice(nextIndex, 0, movedTrackId);
    updateTrackGroup(group.id, { trackIds });
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
    updateSelectedItems,
  } satisfies TimelineWorkbenchInspectorContext<TItemData>;

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
    const extension = extensionItems.find((candidate) =>
      context.item.kind ? candidate.itemKinds?.includes(context.item.kind) : false,
    );

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
            updateTrackGroup(trackGroup.id, {
              trackIds: trackGroup.trackIds.filter((trackId) => trackId !== context.track.id),
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
    ...(document.groups ?? []).flatMap((group): MenuActionItem[] => [
      {
        id: `rename-track-group-${group.id}`,
        label: `Rename ${group.label}`,
        disabled: readOnly,
        onSelect: () => renameTrackGroup(group.id),
      },
      {
        id: `toggle-track-group-${group.id}`,
        label: group.collapsed ? `Expand ${group.label}` : `Collapse ${group.label}`,
        disabled: readOnly,
        onSelect: () => updateTrackGroup(group.id, { collapsed: !group.collapsed }),
      },
      {
        id: `lock-track-group-${group.id}`,
        label: group.locked ? `Unlock ${group.label}` : `Lock ${group.label}`,
        disabled: readOnly,
        onSelect: () => updateTrackGroup(group.id, { locked: !group.locked }),
      },
      {
        id: `remove-track-group-${group.id}`,
        label: `Remove ${group.label}`,
        destructive: true,
        disabled: readOnly,
        onSelect: () => removeTrackGroup(group.id),
      },
    ]),
  ];

  const commitViewport = (nextViewport: TimelineEditorViewport) => {
    if (!viewport) {
      setInternalViewport(nextViewport);
    }

    onViewportChange?.(nextViewport);
  };

  const commitTool = (nextTool: typeof resolvedTool) => {
    if (!tool) {
      setInternalTool(nextTool);
    }

    onToolChange?.(nextTool);
  };

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

    const nextDocument = setTimelineEditorCurrentTime(
      document,
      currentTimeMs + direction * frameStepMs,
      { durationMs, snapMs: frameStepMs },
    );

    onCurrentTimeChange?.(nextDocument.currentTimeMs ?? 0);
    commitDocument(nextDocument);
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

  const handleWorkbenchKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isKeyboardEventFromEditableTarget(event)) {
      return;
    }

    if (readOnly && !(resolvedHotkeys.copy && matchesHotkey(event, resolvedHotkeys.copy))) {
      return;
    }

    if (resolvedHotkeys.undo && matchesHotkey(event, resolvedHotkeys.undo)) {
      event.preventDefault();
      const undo = undoTimelineEditorHistory(history);
      setHistory(undo.history);
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
      const redo = redoTimelineEditorHistory(history);
      setHistory(redo.history);
      if (redo.document) {
        onDocumentChange?.(redo.document);
        if (redo.selection) {
          commitSelection(redo.selection);
        }
      }
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
      onKeyDown={handleWorkbenchKeyDown}
    >
      <TimelineWorkbenchToolbar
        clipboard={resolvedClipboard}
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
        resolvedHotkeys={resolvedHotkeys}
        resolvedTool={resolvedTool}
        renderToolbarActions={renderToolbarActions}
        resolvedSelection={resolvedSelection}
        resolvedViewport={resolvedViewport}
        onAddMarker={addMarker}
        onDelete={() => deleteItems()}
        onCopy={() => copyItems()}
        onCut={() => cutItems()}
        onDuplicate={() => duplicateItems()}
        onGroup={() => groupItems()}
        onPaste={pasteItems}
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
        onToolChange={commitTool}
        onHotkeyChange={commitHotkey}
        onHotkeysReset={resetHotkeys}
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
          onAssetDragEnd={() => setDraggedAssetId(null)}
          onAssetDragStart={(asset) => setDraggedAssetId(asset.id)}
          onInsertAsset={insertAsset}
        />
        <TimelineWorkbenchPreview
          currentTimeMs={currentTimeMs}
          document={document}
          durationMs={durationMs}
          extensions={extensions}
          selectedItems={selectedItems}
        />
        <WorkbenchPanel side="right" className="h-full min-w-0 p-0">
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
        </WorkbenchPanel>
      </div>
      <TimelineWorkbenchCanvas
        assets={assets}
        draggedAssetId={draggedAssetId}
        document={document}
        editPolicy={editPolicy}
        frameRate={frameRate}
        hotkeys={resolvedHotkeys}
        getItemContextMenuItems={getWorkbenchItemContextMenuItems}
        getTrackContextMenuItems={getWorkbenchTrackContextMenuItems}
        readOnly={readOnly}
        tool={resolvedTool}
        minItemDurationMs={minItemDurationMs}
        renderTimelineItem={renderResolvedTimelineItem}
        snap={snap}
        resolvedSelection={resolvedSelection}
        resolvedSnapMs={resolvedSnapMs}
        resolvedViewport={resolvedViewport}
        virtualization={virtualization}
        trackGroupMenuItems={trackGroupMenuItems}
        trackKinds={trackKinds}
        formatTrackKind={formatTimelineWorkbenchTrackKind}
        onAddTrack={addTrack}
        onCurrentTimeChange={onCurrentTimeChange}
        onDocumentChange={commitDocument}
        onDropAsset={insertAssetAt}
        onSelectionChange={commitSelection}
        onViewportChange={commitViewport}
      />
    </div>
  );
}

function isTimelineWorkbenchCurrentTimeOnlyChange<TTrackData, TItemData>(
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

function selectionForItemIds(itemIds: string[]): TimelineEditorSelection {
  return { itemIds, anchorItemId: itemIds[0] };
}

function areTimelineWorkbenchSelectionsEqual(
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

function getTimelineWorkbenchToolHotkey(
  event: React.KeyboardEvent,
  hotkeys: typeof defaultTimelineWorkbenchHotkeys,
): TimelineEditorTool | undefined {
  const entries: Array<[keyof typeof defaultTimelineWorkbenchHotkeys, TimelineEditorTool]> = [
    ["toolSelect", "select"],
    ["toolBlade", "blade"],
    ["toolTrim", "trim"],
    ["toolRippleTrim", "ripple-trim"],
    ["toolPan", "pan"],
  ];

  return entries.find(([hotkeyId]) => {
    const hotkey = hotkeys[hotkeyId];
    return hotkey ? matchesHotkey(event, hotkey) : false;
  })?.[1];
}

function getTimelineWorkbenchTrackKinds<
  TTrackData extends Record<string, unknown>,
  TItemData,
  TAssetData,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  assets: Array<TimelineWorkbenchAsset<TAssetData>>,
  extensions: Array<TimelineEditorExtension<TItemData, TTrackData>>,
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
