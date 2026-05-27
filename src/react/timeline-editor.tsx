"use client";

import { useMemo, useRef, useState } from "react";

import { cn } from "@moritzbrantner/ui";

import {
  canPlaceTimelineEditorItemOnTrack,
  findTimelineEditorItem,
  moveTimelineEditorItems,
  normalizeTimelineEditorDocument,
  resizeTimelineEditorItem,
  setTimelineEditorCurrentTime,
} from "../core";
import {
  createTimelineEditorDocumentIndex,
  getTimelineEditorGroupedItemIdsFromIndex,
} from "../document-index";
import {
  createTimelineEditorSnapResolver,
  createTimelineEditorSnapOptions,
  getTimelineEditorFrameDurationMs,
  getTimelineEditorItemEndMs,
  clampTimelineEditorTime,
} from "../time";
import {
  defaultTimelineEditorSelection,
  defaultTimelineEditorSnapMs,
  type TimelineEditorDocument,
  type TimelineEditorEditPolicy,
  type TimelineEditorItem,
  type TimelineEditorTrack,
} from "../types";
import {
  getTimelineEditorDurationForDocument,
  getTimelineEditorTimeFromDelta,
  getTimelineEditorWidthPx,
  getVisibleTimelineEditorTicksForRange,
} from "./timeline-rendering";
import {
  defaultTimelineEditorHotkeys,
  timelineEditorTrackHeaderWidthPx,
  timelineEditorRulerHeightPx,
  timelineEditorTrackGroupHeightPx,
  timelineEditorDefaultTrackHeightPx,
} from "./timeline-editor/constants";
import { getTimelineEditorNudgeMs } from "./timeline-editor/hotkeys";
import { useTimelineEditorKeyboard } from "./timeline-editor/keyboard";
import {
  captureTimelineEditorPointer,
  getTimelineEditorPointerClientX,
} from "./timeline-editor/pointer";
import { useTimelineEditorPreview } from "./timeline-editor/preview";
import {
  getRangeSelectionIds,
  getSelectedTimelineEditorItems,
  getVisibleTracks,
} from "./timeline-editor/selection";
import { TimelineEditorRuler } from "./timeline-editor/ruler";
import { TimelineEditorTrackList } from "./timeline-editor/track-list";
import type { TimelineEditorDragState, TimelineEditorProps } from "./timeline-editor/types";
import {
  getNextTimelineEditorPixelsPerSecond,
  getTimelineEditorVisibleRange,
  resolveTimelineEditorViewport,
  useTimelineEditorMeasuredViewport,
} from "./timeline-editor/viewport";

export type {
  TimelineEditorHotkeys,
  TimelineEditorItemContextMenuContext,
  TimelineEditorItemContextMenuItems,
  TimelineEditorItemRenderContext,
  TimelineEditorProps,
  TimelineEditorTrackContextMenuContext,
  TimelineEditorTrackContextMenuItems,
  TimelineEditorTrackRenderContext,
  TimelineEditorVirtualizationOptions,
} from "./timeline-editor/types";
export {
  defaultTimelineEditorHotkeys,
  timelineEditorMaxPixelsPerSecond,
  timelineEditorMinPixelsPerSecond,
  timelineEditorTrackHeaderWidthPx,
} from "./timeline-editor/constants";

type TimelineEditorSnapResolver = ReturnType<typeof createTimelineEditorSnapResolver>;

export function TimelineEditor<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>({
  document,
  selection = defaultTimelineEditorSelection,
  viewport,
  readOnly = false,
  frameRate,
  editPolicy,
  snap,
  hotkeys,
  virtualization,
  onDocumentChange,
  onSelectionChange,
  onViewportChange,
  onCurrentTimeChange,
  renderItem,
  renderTrackHeader,
  getItemContextMenuItems,
  getTrackContextMenuItems,
  className,
  onScroll,
  onWheel,
  ...props
}: TimelineEditorProps<TTrackData, TItemData>) {
  const durationMs = getTimelineEditorDurationForDocument(document);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const pendingWheelZoomRef = useRef<{ offsetX: number; timeMs: number } | null>(null);
  const {
    cancelScheduledPreview,
    clearPreview,
    previewTracks,
    schedulePreviewUpdate,
    snapGuideMs,
  } = useTimelineEditorPreview<TTrackData, TItemData>();
  const resolvedViewport = useMemo(() => resolveTimelineEditorViewport(viewport), [viewport]);
  const resolvedVirtualization = useMemo(
    () => ({
      rows: virtualization?.rows ?? "auto",
      rowOverscanPx: virtualization?.rowOverscanPx ?? 240,
    }),
    [virtualization],
  );
  const timelineWidthPx = getTimelineEditorWidthPx(durationMs, resolvedViewport.pixelsPerSecond);
  const editorWidthPx = timelineEditorTrackHeaderWidthPx + timelineWidthPx;
  const frameDurationMs = useMemo(() => getTimelineEditorFrameDurationMs(frameRate), [frameRate]);
  const resolvedSnap = useMemo(
    () => createTimelineEditorSnapOptions(frameDurationMs ?? defaultTimelineEditorSnapMs, snap),
    [frameDurationMs, snap],
  );
  const nudgeMs = useMemo(
    () => getTimelineEditorNudgeMs(frameDurationMs, resolvedSnap),
    [frameDurationMs, resolvedSnap],
  );
  const resolvedHotkeys = useMemo(
    () => ({ ...defaultTimelineEditorHotkeys, ...hotkeys }),
    [hotkeys],
  );
  const [measuredViewport, setMeasuredViewport] = useTimelineEditorMeasuredViewport(
    scrollerRef,
    pendingWheelZoomRef,
    resolvedViewport.pixelsPerSecond,
  );
  const [dragState, setDragState] = useState<TimelineEditorDragState<
    TItemData,
    TimelineEditorSnapResolver
  > | null>(null);
  const selectedIds = useMemo(() => new Set(selection.itemIds), [selection.itemIds]);
  const documentIndex = useMemo(() => createTimelineEditorDocumentIndex(document), [document]);
  const selectedItems = useMemo(
    () => getSelectedTimelineEditorItems(document, selectedIds, documentIndex),
    [document, selectedIds, documentIndex],
  );
  const renderDocument = useMemo(
    () => (previewTracks ? { ...document, tracks: previewTracks } : document),
    [document, previewTracks],
  );
  const renderDocumentIndex = useMemo(
    () => createTimelineEditorDocumentIndex(renderDocument),
    [renderDocument],
  );
  const visibleRange = useMemo(
    () =>
      getTimelineEditorVisibleRange(
        durationMs,
        resolvedViewport,
        measuredViewport,
        timelineEditorTrackHeaderWidthPx,
      ),
    [durationMs, resolvedViewport, measuredViewport],
  );
  const visibleTracks = useMemo(
    () => getVisibleTracks(renderDocument, renderDocumentIndex),
    [renderDocument, renderDocumentIndex],
  );
  const ticks = useMemo(
    () => getVisibleTimelineEditorTicksForRange(durationMs, resolvedViewport, visibleRange),
    [durationMs, resolvedViewport, visibleRange],
  );

  const commitDocument = onDocumentChange ?? (() => undefined);
  const commitSelection = onSelectionChange ?? (() => undefined);
  const handleKeyDown = useTimelineEditorKeyboard({
    document,
    durationMs,
    hotkeys: resolvedHotkeys,
    editPolicy,
    nudgeMs,
    readOnly,
    selection,
    viewport: resolvedViewport,
    onDocumentChange: commitDocument,
    onSelectionChange: commitSelection,
    onViewportChange,
  });

  const selectItem = (
    item: TimelineEditorItem<TItemData>,
    track: TimelineEditorTrack<TTrackData, TItemData>,
    event: React.PointerEvent,
  ) => {
    const groupedItemIds = getTimelineEditorGroupedItemIdsFromIndex(documentIndex, [item.id]);

    if (event.metaKey || event.ctrlKey) {
      const groupedItemIdSet = new Set(groupedItemIds);
      const isGroupSelected = groupedItemIds.every((itemId) => selectedIds.has(itemId));
      const nextIds = isGroupSelected
        ? selection.itemIds.filter((itemId) => !groupedItemIdSet.has(itemId))
        : [...selection.itemIds, ...groupedItemIds.filter((itemId) => !selectedIds.has(itemId))];
      commitSelection({ itemIds: nextIds, anchorItemId: item.id });
      return;
    }

    if (event.shiftKey && selection.anchorItemId) {
      commitSelection({
        itemIds: getTimelineEditorGroupedItemIdsFromIndex(
          documentIndex,
          getRangeSelectionIds(track, selection.anchorItemId, item.id),
        ),
        anchorItemId: selection.anchorItemId,
      });
      return;
    }

    commitSelection({ itemIds: groupedItemIds, anchorItemId: item.id });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState || readOnly) {
      return;
    }

    const deltaMs = getTimelineEditorTimeFromDelta(
      getTimelineEditorPointerClientX(event) - dragState.startX,
      resolvedViewport.pixelsPerSecond,
    );

    if (dragState.type === "move") {
      const activeItem = dragState.originalItems.find((item) => item.id === dragState.itemId);
      const snapResult = activeItem
        ? dragState.snapResolver(activeItem.startMs + deltaMs)
        : { timeMs: 0, snapped: false };
      const resolvedDeltaMs =
        activeItem && snapResult.snapped ? snapResult.timeMs - activeItem.startMs : deltaMs;
      const tracks = getTimelineEditorMoveDragTracks(
        document,
        visibleTracks,
        scrollerRef.current,
        event.clientY,
        dragState,
        resolvedDeltaMs,
        durationMs,
        editPolicy,
      );

      schedulePreviewUpdate(
        tracks === document.tracks ? null : tracks,
        snapResult.snapped ? snapResult.timeMs : null,
      );
      return;
    }

    const edge = dragState.type === "resize-start" ? "start" : "end";
    const nextTimeMs =
      edge === "start" ? dragState.originalStartMs + deltaMs : dragState.originalEndMs + deltaMs;
    const snapResult = dragState.snapResolver(nextTimeMs);
    const tracks = getTimelineEditorResizeDragTracks(
      document.tracks,
      dragState.item,
      edge,
      snapResult.timeMs,
      durationMs,
      editPolicy,
    );

    schedulePreviewUpdate(
      tracks === document.tracks ? null : tracks,
      snapResult.snapped ? snapResult.timeMs : null,
    );
  };

  const commitDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragState && !readOnly) {
      const tracks = getTimelineEditorDragCommitTracks(
        document,
        visibleTracks,
        scrollerRef.current,
        event,
        dragState,
        resolvedViewport.pixelsPerSecond,
        durationMs,
        editPolicy,
      );

      if (tracks !== document.tracks) {
        commitDocument(normalizeTimelineEditorDocument({ ...document, tracks }, { durationMs }));
      }
    }

    cancelScheduledPreview();
    setDragState(null);
    clearPreview();
  };

  const cancelDrag = () => {
    cancelScheduledPreview();
    setDragState(null);
    clearPreview();
  };

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    setMeasuredViewport({
      scrollLeftPx: event.currentTarget.scrollLeft,
      scrollTopPx: event.currentTarget.scrollTop,
      widthPx: event.currentTarget.clientWidth,
      heightPx: event.currentTarget.clientHeight,
    });
    onScroll?.(event);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    onWheel?.(event);

    if (event.defaultPrevented || !event.ctrlKey) {
      return;
    }

    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    const nextPixelsPerSecond = getNextTimelineEditorPixelsPerSecond(
      resolvedViewport.pixelsPerSecond,
      direction,
    );

    if (nextPixelsPerSecond === resolvedViewport.pixelsPerSecond) {
      return;
    }

    const scroller = event.currentTarget;
    const scrollerRect = scroller.getBoundingClientRect();
    const offsetX = clampTimelineEditorTime(
      event.clientX - scrollerRect.left,
      0,
      scroller.clientWidth,
    );
    const timeMs = clampTimelineEditorTime(
      ((scroller.scrollLeft + offsetX - timelineEditorTrackHeaderWidthPx) /
        Math.max(1, resolvedViewport.pixelsPerSecond)) *
        1_000,
      0,
      durationMs,
    );
    pendingWheelZoomRef.current = { offsetX, timeMs };
    onViewportChange?.({
      ...resolvedViewport,
      pixelsPerSecond: nextPixelsPerSecond,
    });
  };

  return (
    <div
      data-slot="timeline-editor"
      data-read-only={readOnly ? "true" : undefined}
      ref={scrollerRef}
      className={cn("overflow-auto rounded-md border bg-card text-card-foreground", className)}
      tabIndex={0}
      onPointerMove={handlePointerMove}
      onPointerUp={commitDrag}
      onPointerCancel={cancelDrag}
      onKeyDown={handleKeyDown}
      onScroll={handleScroll}
      onWheel={handleWheel}
      {...props}
    >
      <div className="relative" style={{ width: editorWidthPx }}>
        <TimelineEditorRuler
          document={document}
          durationMs={durationMs}
          nudgeMs={nudgeMs}
          setCurrentTime={setTimelineEditorCurrentTime}
          snapGuideMs={snapGuideMs}
          ticks={ticks}
          timelineWidthPx={timelineWidthPx}
          visibleRange={visibleRange}
          onCurrentTimeChange={onCurrentTimeChange}
          onDocumentChange={commitDocument}
        />
        <TimelineEditorTrackList
          document={document}
          durationMs={durationMs}
          getItemContextMenuItems={getItemContextMenuItems}
          getTrackContextMenuItems={getTrackContextMenuItems}
          readOnly={readOnly}
          renderItem={renderItem}
          renderTrackHeader={renderTrackHeader}
          selectedIds={selectedIds}
          selectedItems={selectedItems}
          selection={selection}
          timelineWidthPx={timelineWidthPx}
          measuredViewport={measuredViewport}
          visibleRange={visibleRange}
          visibleTracks={visibleTracks}
          virtualization={resolvedVirtualization}
          onClipContextMenu={(item) => {
            if (!selectedIds.has(item.id)) {
              commitSelection({ itemIds: [item.id], anchorItemId: item.id });
            }
          }}
          onClipPointerDown={(item, track, locked, event) => {
            if (locked || event.button !== 0) {
              return;
            }

            event.stopPropagation();
            captureTimelineEditorPointer(event.currentTarget, event.pointerId);
            selectItem(item, track, event);
            const activeSelection = getTimelineEditorGroupedItemIdsFromIndex(
              documentIndex,
              selectedIds.has(item.id) ? selection.itemIds : [item.id],
            );
            const activeSelectionIds = new Set(activeSelection);
            const originalItems = activeSelection.flatMap((itemId) => {
              const selectedItem = documentIndex.itemById.get(itemId);
              return selectedItem ? [selectedItem] : [];
            });
            setDragState({
              type: "move",
              itemId: item.id,
              startX: getTimelineEditorPointerClientX(event),
              originalItems,
              movingItemIds: activeSelectionIds,
              sourceTrackId: documentIndex.trackByItemId.get(item.id)?.id ?? item.trackId,
              snapResolver: createTimelineEditorSnapResolver(
                document,
                resolvedSnap,
                resolvedViewport.pixelsPerSecond,
                { excludeItemIds: activeSelectionIds },
              ),
            });
          }}
          onResizePointerDown={(edge, item, locked, event) => {
            if (locked || event.button !== 0) {
              return;
            }

            event.stopPropagation();
            captureTimelineEditorPointer(event.currentTarget, event.pointerId);
            commitSelection({ itemIds: [item.id], anchorItemId: item.id });
            setDragState({
              type: edge === "start" ? "resize-start" : "resize-end",
              item,
              trackId: documentIndex.trackByItemId.get(item.id)?.id ?? item.trackId,
              startX: getTimelineEditorPointerClientX(event),
              originalStartMs: item.startMs,
              originalEndMs: getTimelineEditorItemEndMs(item),
              snapResolver: createTimelineEditorSnapResolver(
                document,
                resolvedSnap,
                resolvedViewport.pixelsPerSecond,
                { excludeItemIds: [item.id] },
              ),
            });
          }}
        />
        <span className="sr-only" aria-live="polite">
          {selection.itemIds.length > 0
            ? `${selection.itemIds.length} timeline items selected`
            : "No timeline items selected"}
        </span>
      </div>
    </div>
  );
}

function getTimelineEditorDragCommitTracks<TTrackData extends Record<string, unknown>, TItemData>(
  document: TimelineEditorDocument<TTrackData, TItemData>,
  visibleTracks: ReturnType<typeof getVisibleTracks<TTrackData, TItemData>>,
  scroller: HTMLDivElement | null,
  event: React.PointerEvent<HTMLDivElement>,
  dragState: TimelineEditorDragState<TItemData, TimelineEditorSnapResolver>,
  pixelsPerSecond: number,
  durationMs: number,
  editPolicy: Partial<TimelineEditorEditPolicy> | undefined,
) {
  const deltaMs = getTimelineEditorTimeFromDelta(
    getTimelineEditorPointerClientX(event) - dragState.startX,
    pixelsPerSecond,
  );

  if (dragState.type === "move") {
    const activeItem = dragState.originalItems.find((item) => item.id === dragState.itemId);
    const snapResult = activeItem
      ? dragState.snapResolver(activeItem.startMs + deltaMs)
      : { timeMs: 0, snapped: false };
    const resolvedDeltaMs =
      activeItem && snapResult.snapped ? snapResult.timeMs - activeItem.startMs : deltaMs;

    return getTimelineEditorMoveDragTracks(
      document,
      visibleTracks,
      scroller,
      event.clientY,
      dragState,
      resolvedDeltaMs,
      durationMs,
      editPolicy,
    );
  }

  const edge = dragState.type === "resize-start" ? "start" : "end";
  const nextTimeMs =
    edge === "start" ? dragState.originalStartMs + deltaMs : dragState.originalEndMs + deltaMs;
  const snapResult = dragState.snapResolver(nextTimeMs);

  return getTimelineEditorResizeDragTracks(
    document.tracks,
    dragState.item,
    edge,
    snapResult.timeMs,
    durationMs,
    editPolicy,
  );
}

function getTimelineEditorMoveDragTracks<TTrackData extends Record<string, unknown>, TItemData>(
  document: TimelineEditorDocument<TTrackData, TItemData>,
  visibleTracks: ReturnType<typeof getVisibleTracks<TTrackData, TItemData>>,
  scroller: HTMLDivElement | null,
  clientY: number,
  dragState: Extract<
    TimelineEditorDragState<TItemData, TimelineEditorSnapResolver>,
    { type: "move" }
  >,
  deltaMs: number,
  durationMs: number,
  editPolicy: Partial<TimelineEditorEditPolicy> | undefined,
) {
  const targetTrackId = getTimelineEditorTrackIdAtClientY(visibleTracks, scroller, clientY);
  const sourceTrackIndex = document.tracks.findIndex(
    (track) => track.id === dragState.sourceTrackId,
  );
  const targetTrackIndex =
    targetTrackId === undefined
      ? -1
      : document.tracks.findIndex((track) => track.id === targetTrackId);
  const trackDelta =
    sourceTrackIndex === -1 || targetTrackIndex === -1
      ? undefined
      : targetTrackIndex - sourceTrackIndex;

  if (
    trackDelta !== undefined &&
    trackDelta !== 0 &&
    !canMoveTimelineEditorItemsByTrackDelta(
      document.tracks,
      dragState.movingItemIds,
      trackDelta,
      visibleTracks,
    )
  ) {
    return document.tracks;
  }

  return moveTimelineEditorItems(document.tracks, [...dragState.movingItemIds], deltaMs, {
    durationMs,
    editPolicy,
    ...(trackDelta !== undefined && trackDelta !== 0 ? { trackDelta } : {}),
  });
}

function getTimelineEditorTrackIdAtClientY<TTrackData, TItemData>(
  visibleTracks: ReturnType<typeof getVisibleTracks<TTrackData, TItemData>>,
  scroller: HTMLDivElement | null,
  clientY: number,
) {
  if (!scroller || !Number.isFinite(clientY)) {
    return undefined;
  }

  const bounds = scroller.getBoundingClientRect();
  const yPx = clientY - bounds.top + scroller.scrollTop - timelineEditorRulerHeightPx;
  let topPx = 0;
  let nearestTrackId: string | undefined;
  let nearestDistancePx = Number.POSITIVE_INFINITY;

  for (const entry of visibleTracks) {
    const heightPx =
      entry.type === "group"
        ? timelineEditorTrackGroupHeightPx
        : (entry.track.height ?? timelineEditorDefaultTrackHeightPx);
    const bottomPx = topPx + heightPx;

    if (yPx >= topPx && yPx <= bottomPx && (entry.type !== "track" || entry.locked)) {
      return undefined;
    }

    if (entry.type === "track" && !entry.locked) {
      if (yPx >= topPx && yPx <= bottomPx) {
        return entry.track.id;
      }

      const distancePx = yPx < topPx ? topPx - yPx : yPx - bottomPx;

      if (distancePx < nearestDistancePx) {
        nearestDistancePx = distancePx;
        nearestTrackId = entry.track.id;
      }
    }

    topPx = bottomPx;
  }

  return nearestTrackId;
}

function canMoveTimelineEditorItemsByTrackDelta<TTrackData, TItemData>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  movingItemIds: ReadonlySet<string>,
  trackDelta: number,
  visibleTracks: ReturnType<typeof getVisibleTracks<TTrackData, TItemData>>,
) {
  const lockedTrackIds = new Set(
    visibleTracks
      .filter((entry) => entry.type === "track" && entry.locked)
      .map((entry) => (entry.type === "track" ? entry.track.id : "")),
  );

  for (const itemId of movingItemIds) {
    const found = findTimelineEditorItem(tracks, itemId);

    if (!found || found.item.locked || found.track.locked) {
      return false;
    }

    const currentTrackIndex = tracks.findIndex((track) => track.id === found.track.id);
    const targetTrack =
      tracks[clampTimelineEditorTime(currentTrackIndex + trackDelta, 0, tracks.length - 1)];

    if (
      !targetTrack ||
      lockedTrackIds.has(targetTrack.id) ||
      !canPlaceTimelineEditorItemOnTrack(found.item, targetTrack)
    ) {
      return false;
    }
  }

  return true;
}

function getTimelineEditorResizeDragTracks<TTrackData, TItemData>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  item: TimelineEditorItem<TItemData>,
  edge: "start" | "end",
  timeMs: number,
  durationMs: number,
  editPolicy: Partial<TimelineEditorEditPolicy> | undefined,
) {
  return resizeTimelineEditorItem(
    tracks,
    edge === "start"
      ? { itemId: item.id, edge, startMs: timeMs }
      : { itemId: item.id, edge, durationMs: timeMs - item.startMs },
    { durationMs, editPolicy },
  );
}
