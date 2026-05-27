"use client";

import { useMemo, useRef, useState } from "react";

import { cn } from "@moritzbrantner/ui";

import { normalizeTimelineEditorDocument, setTimelineEditorCurrentTime } from "../core";
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
  defaultTimelineEditorMinItemDurationMs,
  defaultTimelineEditorSnapMs,
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
    flushScheduledPreview,
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
      const tracks = getTimelineEditorMovePreviewTracks(
        document.tracks,
        dragState.movingItemIds,
        resolvedDeltaMs,
        durationMs,
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
    const tracks = getTimelineEditorResizePreviewTracks(
      document.tracks,
      dragState.trackId,
      dragState.item,
      edge,
      snapResult.timeMs,
      durationMs,
    );

    schedulePreviewUpdate(
      tracks === document.tracks ? null : tracks,
      snapResult.snapped ? snapResult.timeMs : null,
    );
  };

  const commitDrag = () => {
    const tracks = flushScheduledPreview();

    if (tracks && tracks !== document.tracks) {
      commitDocument(normalizeTimelineEditorDocument({ ...document, tracks }, { durationMs }));
    }

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

function getTimelineEditorMovePreviewTracks<TTrackData, TItemData>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  movingItemIds: ReadonlySet<string>,
  deltaMs: number,
  durationMs: number,
) {
  let changed = false;

  const nextTracks = tracks.map((track) => {
    if (track.locked) {
      return track;
    }

    let trackChanged = false;
    const nextItems = track.items.map((item) => {
      if (!movingItemIds.has(item.id) || item.locked) {
        return item;
      }

      const startMs = clampTimelineEditorTime(
        item.startMs + deltaMs,
        0,
        Math.max(0, durationMs - item.durationMs),
      );

      if (startMs === item.startMs) {
        return item;
      }

      changed = true;
      trackChanged = true;
      return { ...item, startMs };
    });

    return trackChanged ? { ...track, items: nextItems } : track;
  });

  return changed ? nextTracks : tracks;
}

function getTimelineEditorResizePreviewTracks<TTrackData, TItemData>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  trackId: string,
  item: TimelineEditorItem<TItemData>,
  edge: "start" | "end",
  timeMs: number,
  durationMs: number,
) {
  const originalEndMs = getTimelineEditorItemEndMs(item);
  const nextStartMs =
    edge === "start"
      ? clampTimelineEditorTime(timeMs, 0, originalEndMs - defaultTimelineEditorMinItemDurationMs)
      : item.startMs;
  const nextEndMs =
    edge === "end"
      ? clampTimelineEditorTime(
          timeMs,
          item.startMs + defaultTimelineEditorMinItemDurationMs,
          durationMs,
        )
      : originalEndMs;
  const nextDurationMs = nextEndMs - nextStartMs;

  if (nextStartMs === item.startMs && nextDurationMs === item.durationMs) {
    return tracks;
  }

  return tracks.map((track) =>
    track.id === trackId
      ? {
          ...track,
          items: track.items.map((candidate) =>
            candidate.id === item.id
              ? { ...candidate, startMs: nextStartMs, durationMs: nextDurationMs }
              : candidate,
          ),
        }
      : track,
  );
}
