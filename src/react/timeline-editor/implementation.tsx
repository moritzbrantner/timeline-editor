"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@moritzbrantner/ui";

import {
  canPlaceTimelineEditorItemOnTrack,
  findTimelineEditorItem,
  moveTimelineEditorItems,
  normalizeTimelineEditorDocument,
  resizeTimelineEditorItem,
  setTimelineEditorCurrentTime,
  splitTimelineEditorItems,
  updateTimelineEditorMarker,
} from "../../core";
import {
  createTimelineEditorDocumentIndex,
  getTimelineEditorGroupedItemIdsFromIndex,
} from "../../document-index";
import {
  createTimelineEditorSnapResolver,
  createTimelineEditorSnapOptions,
  formatTimelineEditorTimeMs,
  getTimelineEditorFrameDurationMs,
  getTimelineEditorItemEndMs,
  clampTimelineEditorTime,
  snapTimelineEditorTime,
} from "../../time";
import {
  defaultTimelineEditorSelection,
  defaultTimelineEditorSnapMs,
  type TimelineEditorDocument,
  type TimelineEditorEditPolicy,
  type TimelineEditorItem,
  type TimelineEditorMarker,
  type TimelineEditorTrack,
} from "../../types";
import {
  getTimelineEditorDurationForDocument,
  getTimelineEditorTimeFromDelta,
  getTimelineEditorWidthPx,
  getVisibleTimelineEditorTicksForRange,
} from "../timeline-rendering";
import {
  defaultTimelineEditorHotkeys,
  timelineEditorTrackHeaderWidthPx,
  timelineEditorRulerHeightPx,
  timelineEditorTrackGroupHeightPx,
  timelineEditorDefaultTrackHeightPx,
} from "./constants";
import { getTimelineEditorNudgeMs } from "./hotkeys";
import { useTimelineEditorKeyboard } from "./keyboard";
import {
  captureTimelineEditorPointer,
  getTimelineEditorPointerClientX,
  isTimelineEditorPrimaryPointerButton,
} from "./pointer";
import { useTimelineEditorPreview } from "./preview";
import {
  getRangeSelectionIds,
  getSelectedTimelineEditorItems,
  getVisibleTracks,
} from "./selection";
import { TimelineEditorRuler } from "./ruler";
import { TimelineEditorTrackList } from "./track-list";
import type {
  TimelineEditorDragState,
  TimelineEditorProps,
  TimelineEditorTimelineContextMenuContext,
} from "./types";
import {
  getNextTimelineEditorPixelsPerSecond,
  getTimelineEditorScrollLeftMs,
  getTimelineEditorVisibleRange,
  resolveTimelineEditorViewport,
  useTimelineEditorMeasuredViewport,
} from "./viewport";

export type {
  TimelineEditorHotkeys,
  TimelineEditorItemContextMenuContext,
  TimelineEditorItemContextMenuItems,
  TimelineEditorItemRenderContext,
  TimelineEditorProps,
  TimelineEditorTrackContextMenuContext,
  TimelineEditorTrackContextMenuItems,
  TimelineEditorTrackRenderContext,
  TimelineEditorTimelineContextMenuContext,
  TimelineEditorTimelineContextMenuItems,
  TimelineEditorTimelineContextMenuSource,
  TimelineEditorTrackGroupRenderContext,
  TimelineEditorVirtualizationOptions,
} from "./types";
export {
  defaultTimelineEditorHotkeys,
  timelineEditorMaxPixelsPerSecond,
  timelineEditorMinPixelsPerSecond,
  timelineEditorTrackHeaderWidthPx,
} from "./constants";

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
  tool = "select",
  minItemDurationMs,
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
  renderTrackGroupHeader,
  getItemContextMenuItems,
  getTrackContextMenuItems,
  getTimelineContextMenuItems,
  className,
  style,
  onPointerDown,
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
    resolvedViewport.scrollLeftMs,
  );
  const [dragState, setDragState] = useState<TimelineEditorDragState<
    TItemData,
    TimelineEditorSnapResolver
  > | null>(null);
  const [markerDragState, setMarkerDragState] = useState<{
    marker: TimelineEditorMarker;
    startX: number;
    originalTimeMs: number;
  } | null>(null);
  const [rangeDragState, setRangeDragState] = useState<{
    startTimeMs: number;
    trackId?: string;
  } | null>(null);
  const [scrubState, setScrubState] = useState<{ pointerId: number } | null>(null);
  const rangeDragStateRef = useRef<typeof rangeDragState>(null);
  const scrubStateRef = useRef<typeof scrubState>(null);
  const mouseRangeDragStateRef = useRef<typeof rangeDragState>(null);
  const mouseScrubbingRef = useRef(false);
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
    () =>
      getVisibleTimelineEditorTicksForRange(
        durationMs,
        resolvedViewport,
        visibleRange,
        frameDurationMs,
      ),
    [durationMs, frameDurationMs, resolvedViewport, visibleRange],
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
    onCurrentTimeChange,
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

  const beginTimelineScrub = (event: React.PointerEvent<Element>) => {
    const scroller = scrollerRef.current;

    if (
      event.defaultPrevented ||
      !isTimelineEditorPrimaryPointerButton(event) ||
      !scroller ||
      dragState ||
      markerDragState
    ) {
      return false;
    }

    event.preventDefault();
    captureTimelineEditorPointer(scroller, event.pointerId);
    const nextScrubState = { pointerId: event.pointerId };
    scrubStateRef.current = nextScrubState;
    setScrubState(nextScrubState);
    return true;
  };

  const getTimeAtClientX = (clientX: number) => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return 0;
    }

    const scrollerRect = scroller.getBoundingClientRect();
    const timelineOffsetPx =
      clientX - scrollerRect.left + scroller.scrollLeft - timelineEditorTrackHeaderWidthPx;
    return clampTimelineEditorTime(
      (timelineOffsetPx / Math.max(1, resolvedViewport.pixelsPerSecond)) * 1_000,
      0,
      durationMs,
    );
  };

  const commitCurrentTimeAtClientX = (clientX: number) => {
    const timeMs = getTimeAtClientX(clientX);
    const nextDocument = setTimelineEditorCurrentTime(document, timeMs, {
      durationMs,
      snapMs: nudgeMs,
    });

    onCurrentTimeChange?.(nextDocument.currentTimeMs ?? 0);

    if (nextDocument !== document) {
      commitDocument(nextDocument);
    }
  };

  const beginRangeSelection = (event: React.PointerEvent<Element>, trackId?: string) => {
    const scroller = scrollerRef.current;

    if (!scroller || event.defaultPrevented || !isTimelineEditorPrimaryPointerButton(event)) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    captureTimelineEditorPointer(scroller, event.pointerId);
    const startTimeMs = snapTimelineEditorTime(
      getTimeAtClientX(getTimelineEditorPointerClientX(event)),
      nudgeMs,
    );
    const nextRangeDragState = { startTimeMs, trackId };
    rangeDragStateRef.current = nextRangeDragState;
    setRangeDragState(nextRangeDragState);
    commitSelection({
      ...selection,
      itemIds: [],
      anchorItemId: undefined,
      trackIds: trackId ? [trackId] : undefined,
      range: { startMs: startTimeMs, endMs: startTimeMs },
    });
    return true;
  };

  const getTimelineContextMenuContext = (
    source: TimelineEditorTimelineContextMenuContext<TTrackData, TItemData>["source"],
    event: React.MouseEvent<Element>,
    track?: TimelineEditorTrack<TTrackData, TItemData>,
    locked = false,
  ): TimelineEditorTimelineContextMenuContext<TTrackData, TItemData> => {
    const scroller = scrollerRef.current;
    const scrollerRect = scroller?.getBoundingClientRect();
    const timelineOffsetPx =
      scroller && scrollerRect
        ? event.clientX - scrollerRect.left + scroller.scrollLeft - timelineEditorTrackHeaderWidthPx
        : 0;
    const timeMs = clampTimelineEditorTime(
      (timelineOffsetPx / Math.max(1, resolvedViewport.pixelsPerSecond)) * 1_000,
      0,
      durationMs,
    );
    const snapResult = createTimelineEditorSnapResolver(
      document,
      resolvedSnap,
      resolvedViewport.pixelsPerSecond,
    )(timeMs);
    const snappedTimeMs = clampTimelineEditorTime(snapResult.timeMs, 0, durationMs);

    return {
      document,
      durationMs,
      frameRate,
      readOnly,
      selection,
      selectedItems,
      source,
      timeMs,
      snappedTimeMs,
      snapped: snapResult.snapped,
      clientX: event.clientX,
      clientY: event.clientY,
      track,
      locked: Boolean(readOnly || locked),
      viewport: resolvedViewport,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const activeRangeDragState = rangeDragStateRef.current ?? rangeDragState;
    const activeScrubState = scrubStateRef.current ?? scrubState;

    if (activeRangeDragState) {
      const timeMs = snapTimelineEditorTime(
        getTimeAtClientX(getTimelineEditorPointerClientX(event)),
        nudgeMs,
      );
      commitSelection({
        ...selection,
        itemIds: [],
        anchorItemId: undefined,
        trackIds: activeRangeDragState.trackId ? [activeRangeDragState.trackId] : undefined,
        range: normalizeTimelineEditorDragRange(activeRangeDragState.startTimeMs, timeMs),
      });
      return;
    }

    if (activeScrubState) {
      if (event.pointerId === activeScrubState.pointerId) {
        commitCurrentTimeAtClientX(getTimelineEditorPointerClientX(event));
      }

      return;
    }

    if (markerDragState || !dragState || readOnly) {
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
    if (markerDragState && !readOnly) {
      const deltaMs = getTimelineEditorTimeFromDelta(
        getTimelineEditorPointerClientX(event) - markerDragState.startX,
        resolvedViewport.pixelsPerSecond,
      );
      const snapResolver = createTimelineEditorSnapResolver(
        document,
        resolvedSnap,
        resolvedViewport.pixelsPerSecond,
      );
      const snapResult = snapResolver(markerDragState.originalTimeMs + deltaMs);
      if (snapResult.timeMs === markerDragState.originalTimeMs) {
        cancelScheduledPreview();
        setDragState(null);
        setMarkerDragState(null);
        clearPreview();
        return;
      }
      const nextDocument = updateTimelineEditorMarker(
        document,
        markerDragState.marker.id,
        { timeMs: snapResult.timeMs },
        { durationMs, snapMs: nudgeMs },
      );

      if (nextDocument !== document) {
        commitDocument(nextDocument);
      }
    }

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
    setMarkerDragState(null);
    rangeDragStateRef.current = null;
    scrubStateRef.current = null;
    setRangeDragState(null);
    setScrubState(null);
    clearPreview();
  };

  const cancelDrag = () => {
    cancelScheduledPreview();
    setDragState(null);
    setMarkerDragState(null);
    rangeDragStateRef.current = null;
    scrubStateRef.current = null;
    setRangeDragState(null);
    setScrubState(null);
    clearPreview();
  };

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    setMeasuredViewport({
      scrollLeftPx: event.currentTarget.scrollLeft,
      scrollTopPx: event.currentTarget.scrollTop,
      widthPx: event.currentTarget.clientWidth,
      heightPx: event.currentTarget.clientHeight,
    });
    onViewportChange?.({
      ...resolvedViewport,
      scrollLeftMs: getTimelineEditorScrollLeftMs(
        event.currentTarget.scrollLeft,
        resolvedViewport.pixelsPerSecond,
        durationMs,
      ),
    });
    onScroll?.(event);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    onPointerDown?.(event);

    if (event.defaultPrevented || !isTimelineEditorPrimaryPointerButton(event)) {
      return;
    }

    const target = event.target instanceof Element ? event.target : null;

    if (target?.closest("[data-slot='timeline-editor-ruler-lane']")) {
      return;
    }

    if (
      target?.closest("[data-slot='timeline-editor-track']") &&
      !target.closest("[data-slot='timeline-editor-clip']")
    ) {
      if (event.shiftKey) {
        const trackElement = target.closest<HTMLElement>("[data-slot='timeline-editor-track']");
        beginRangeSelection(event, trackElement?.dataset["trackId"]);
        return;
      }

      beginTimelineScrub(event);
      commitSelection(defaultTimelineEditorSelection);
    }
  };

  const handlePointerDownCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;

    if (
      event.defaultPrevented ||
      !isTimelineEditorPrimaryPointerButton(event) ||
      target?.closest("[data-slot='timeline-editor-ruler']") ||
      target?.closest("[data-slot='timeline-editor-clip']") ||
      target?.closest("[data-slot='timeline-editor-track-header']")
    ) {
      return;
    }

    const trackElement = target?.closest<HTMLElement>("[data-slot='timeline-editor-track']");
    const trackId = trackElement?.dataset["trackId"];

    if (!trackId) {
      return;
    }

    const visibleTrack = visibleTracks.find(
      (entry) => entry.type === "track" && entry.track.id === trackId,
    );

    if (!visibleTrack || visibleTrack.type !== "track" || visibleTrack.locked) {
      return;
    }

    if (event.shiftKey) {
      beginRangeSelection(event, trackId);
      return;
    }

    event.stopPropagation();
    beginTimelineScrub(event);
    commitSelection(defaultTimelineEditorSelection);
  };

  const handleMouseDownCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    const trackId = getTimelineEditorEventTrackId(event);

    if (event.defaultPrevented || event.button !== 0 || !trackId) {
      return;
    }

    const visibleTrack = visibleTracks.find(
      (entry) => entry.type === "track" && entry.track.id === trackId,
    );

    if (!visibleTrack || visibleTrack.type !== "track" || visibleTrack.locked) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.shiftKey) {
      const startTimeMs = snapTimelineEditorTime(getTimeAtClientX(event.clientX), nudgeMs);
      const nextRangeDragState = { startTimeMs, trackId };
      mouseRangeDragStateRef.current = nextRangeDragState;
      commitSelection({
        ...selection,
        itemIds: [],
        anchorItemId: undefined,
        trackIds: [trackId],
        range: { startMs: startTimeMs, endMs: startTimeMs },
      });
      return;
    }

    mouseScrubbingRef.current = true;
    commitCurrentTimeAtClientX(event.clientX);
    commitSelection(defaultTimelineEditorSelection);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const mouseRangeDragState = mouseRangeDragStateRef.current;

    if (mouseRangeDragState) {
      const timeMs = snapTimelineEditorTime(getTimeAtClientX(event.clientX), nudgeMs);
      commitSelection({
        ...selection,
        itemIds: [],
        anchorItemId: undefined,
        trackIds: mouseRangeDragState.trackId ? [mouseRangeDragState.trackId] : undefined,
        range: normalizeTimelineEditorDragRange(mouseRangeDragState.startTimeMs, timeMs),
      });
      return;
    }

    if (mouseScrubbingRef.current) {
      commitCurrentTimeAtClientX(event.clientX);
    }
  };

  const clearMouseInteraction = () => {
    mouseRangeDragStateRef.current = null;
    mouseScrubbingRef.current = false;
  };

  const handleNativeWheel = useCallback(
    (event: WheelEvent) => {
      if (event.defaultPrevented || !event.cancelable) {
        return;
      }

      const scroller = scrollerRef.current;

      if (!scroller) {
        return;
      }

      if (!event.ctrlKey) {
        const deltaX = getTimelineEditorWheelDeltaPx(event.deltaX, event.deltaMode, scroller);
        const deltaY = getTimelineEditorWheelDeltaPx(event.deltaY, event.deltaMode, scroller);

        if (event.shiftKey) {
          const verticalDeltaPx = deltaY || deltaX;

          if (verticalDeltaPx === 0) {
            return;
          }

          event.preventDefault();
          scroller.scrollTop += verticalDeltaPx;
          return;
        }

        const horizontalDeltaPx = deltaX + deltaY;

        if (horizontalDeltaPx === 0) {
          return;
        }

        event.preventDefault();
        scroller.scrollLeft += horizontalDeltaPx;
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
    },
    [durationMs, onViewportChange, resolvedViewport],
  );

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    scroller.addEventListener("wheel", handleNativeWheel, { passive: false });

    return () => {
      scroller.removeEventListener("wheel", handleNativeWheel);
    };
  }, [handleNativeWheel]);

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    const handleNativeMouseDown = (event: MouseEvent) => {
      const trackId = getTimelineEditorNativeEventTrackId(event);

      if (event.defaultPrevented || event.button !== 0 || !trackId) {
        return;
      }

      const visibleTrack = visibleTracks.find(
        (entry) => entry.type === "track" && entry.track.id === trackId,
      );

      if (!visibleTrack || visibleTrack.type !== "track" || visibleTrack.locked) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (event.shiftKey) {
        const startTimeMs = snapTimelineEditorTime(getTimeAtClientX(event.clientX), nudgeMs);
        mouseRangeDragStateRef.current = { startTimeMs, trackId };
        commitSelection({
          ...selection,
          itemIds: [],
          anchorItemId: undefined,
          trackIds: [trackId],
          range: { startMs: startTimeMs, endMs: startTimeMs },
        });
        return;
      }

      mouseScrubbingRef.current = true;
      commitCurrentTimeAtClientX(event.clientX);
      commitSelection(defaultTimelineEditorSelection);
    };

    const handleNativeMouseMove = (event: MouseEvent) => {
      const mouseRangeDragState = mouseRangeDragStateRef.current;

      if (mouseRangeDragState) {
        const timeMs = snapTimelineEditorTime(getTimeAtClientX(event.clientX), nudgeMs);
        commitSelection({
          ...selection,
          itemIds: [],
          anchorItemId: undefined,
          trackIds: mouseRangeDragState.trackId ? [mouseRangeDragState.trackId] : undefined,
          range: normalizeTimelineEditorDragRange(mouseRangeDragState.startTimeMs, timeMs),
        });
        return;
      }

      if (mouseScrubbingRef.current) {
        commitCurrentTimeAtClientX(event.clientX);
      }
    };

    scroller.addEventListener("mousedown", handleNativeMouseDown, true);
    window.addEventListener("mousemove", handleNativeMouseMove);
    window.addEventListener("mouseup", clearMouseInteraction);

    return () => {
      scroller.removeEventListener("mousedown", handleNativeMouseDown, true);
      window.removeEventListener("mousemove", handleNativeMouseMove);
      window.removeEventListener("mouseup", clearMouseInteraction);
    };
  }, [
    commitSelection,
    commitCurrentTimeAtClientX,
    getTimeAtClientX,
    nudgeMs,
    selection,
    visibleTracks,
  ]);

  return (
    <div
      data-slot="timeline-editor"
      data-read-only={readOnly ? "true" : undefined}
      ref={scrollerRef}
      className={cn(
        "min-w-0 max-w-full overflow-auto rounded-md border bg-card text-card-foreground",
        className,
      )}
      style={{
        overscrollBehavior: "contain",
        overflowAnchor: "none",
        ...style,
      }}
      tabIndex={0}
      onPointerMove={handlePointerMove}
      onPointerDownCapture={handlePointerDownCapture}
      onPointerDown={handlePointerDown}
      onPointerUp={commitDrag}
      onPointerCancel={cancelDrag}
      onMouseDownCapture={handleMouseDownCapture}
      onMouseMove={handleMouseMove}
      onMouseUp={clearMouseInteraction}
      onMouseLeave={clearMouseInteraction}
      onKeyDown={handleKeyDown}
      onScroll={handleScroll}
      onWheel={onWheel}
      {...props}
    >
      <div className="relative" style={{ width: editorWidthPx }}>
        <TimelineEditorRuler
          document={document}
          durationMs={durationMs}
          getTimelineContextMenuItems={getTimelineContextMenuItems}
          getTimelineContextMenuContext={(event) => getTimelineContextMenuContext("ruler", event)}
          nudgeMs={nudgeMs}
          readOnly={readOnly}
          selection={selection}
          setCurrentTime={setTimelineEditorCurrentTime}
          snapGuideMs={snapGuideMs}
          ticks={ticks}
          timelineWidthPx={timelineWidthPx}
          visibleRange={visibleRange}
          onCurrentTimeChange={onCurrentTimeChange}
          onDocumentChange={commitDocument}
          onMarkerPointerDown={(marker, event) => {
            captureTimelineEditorPointer(event.currentTarget, event.pointerId);
            const nextDocument = setTimelineEditorCurrentTime(document, marker.timeMs, {
              durationMs,
              snapMs: nudgeMs,
            });
            onCurrentTimeChange?.(nextDocument.currentTimeMs ?? 0);
            if (nextDocument !== document) {
              commitDocument(nextDocument);
            }
            commitSelection({ ...selection, markerIds: [marker.id] });
            setMarkerDragState({
              marker,
              startX: getTimelineEditorPointerClientX(event),
              originalTimeMs: marker.timeMs,
            });
          }}
          onRangePointerDown={(event) => beginRangeSelection(event)}
          onScrubPointerDown={beginTimelineScrub}
        />
        <TimelineEditorTrackList
          document={document}
          durationMs={durationMs}
          getItemContextMenuItems={getItemContextMenuItems}
          getTimelineContextMenuContext={(event, track, locked) =>
            getTimelineContextMenuContext("track-lane", event, track, locked)
          }
          getTimelineContextMenuItems={getTimelineContextMenuItems}
          getTrackContextMenuItems={getTrackContextMenuItems}
          readOnly={readOnly}
          renderItem={renderItem}
          renderTrackGroupHeader={renderTrackGroupHeader}
          renderTrackHeader={renderTrackHeader}
          selectedIds={selectedIds}
          selectedItems={selectedItems}
          selection={selection}
          ticks={ticks}
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

            if (tool === "blade") {
              const scroller = scrollerRef.current;
              const scrollerRect = scroller?.getBoundingClientRect();
              const timeMs =
                scroller && scrollerRect
                  ? clampTimelineEditorTime(
                      ((event.clientX -
                        scrollerRect.left +
                        scroller.scrollLeft -
                        timelineEditorTrackHeaderWidthPx) /
                        Math.max(1, resolvedViewport.pixelsPerSecond)) *
                        1_000,
                      0,
                      durationMs,
                    )
                  : item.startMs;
              const tracks = splitTimelineEditorItems(
                document.tracks,
                getTimelineEditorGroupedItemIdsFromIndex(documentIndex, [item.id]),
                timeMs,
                {
                  durationMs,
                  editPolicy,
                  minItemDurationMs,
                  snapMs: nudgeMs,
                },
              );

              if (tracks !== document.tracks) {
                commitDocument(
                  normalizeTimelineEditorDocument({ ...document, tracks }, { durationMs }),
                );
              }

              return;
            }

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
          onTrackLanePointerDown={(track, locked, event) => {
            if (
              locked ||
              event.defaultPrevented ||
              !isTimelineEditorPrimaryPointerButton(event) ||
              (event.target instanceof Element &&
                (event.target.closest("[data-slot='timeline-editor-clip']") ||
                  event.target.closest("[data-slot='timeline-editor-track-header']")))
            ) {
              return;
            }

            if (event.shiftKey) {
              beginRangeSelection(event, track.id);
              return;
            }

            event.stopPropagation();
            beginTimelineScrub(event);
            commitSelection(defaultTimelineEditorSelection);
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
        {snapGuideMs !== null ? (
          <div
            data-slot="timeline-editor-snap-feedback"
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 top-9 z-20 border-l-2 border-primary/80"
            style={{
              left:
                timelineEditorTrackHeaderWidthPx +
                (snapGuideMs / Math.max(1, durationMs)) * timelineWidthPx,
            }}
          >
            <span
              data-slot="timeline-editor-snap-feedback-label"
              className="absolute left-1 top-1 whitespace-nowrap rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-foreground shadow-sm"
            >
              {formatTimelineEditorTimeMs(snapGuideMs)}
            </span>
          </div>
        ) : null}
        <span className="sr-only" aria-live="polite">
          {selection.itemIds.length > 0
            ? `${selection.itemIds.length} timeline items selected`
            : "No timeline items selected"}
        </span>
      </div>
    </div>
  );
}

function getTimelineEditorWheelDeltaPx(delta: number, deltaMode: number, scroller: HTMLDivElement) {
  if (deltaMode === 1) {
    return delta * 40;
  }

  if (deltaMode === 2) {
    return delta * scroller.clientWidth;
  }

  return delta;
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

function normalizeTimelineEditorDragRange(startMs: number, endMs: number) {
  return startMs <= endMs ? { startMs, endMs } : { startMs: endMs, endMs: startMs };
}

function getTimelineEditorEventTrackId(event: React.MouseEvent<Element>) {
  const target = event.target instanceof Element ? event.target : null;

  if (
    target?.closest("[data-slot='timeline-editor-ruler']") ||
    target?.closest("[data-slot='timeline-editor-clip']") ||
    target?.closest("[data-slot='timeline-editor-track-header']")
  ) {
    return undefined;
  }

  return target?.closest<HTMLElement>("[data-slot='timeline-editor-track']")?.dataset["trackId"];
}

function getTimelineEditorNativeEventTrackId(event: MouseEvent) {
  const target = event.target instanceof Element ? event.target : null;

  if (
    target?.closest("[data-slot='timeline-editor-ruler']") ||
    target?.closest("[data-slot='timeline-editor-clip']") ||
    target?.closest("[data-slot='timeline-editor-track-header']")
  ) {
    return undefined;
  }

  return target?.closest<HTMLElement>("[data-slot='timeline-editor-track']")?.dataset["trackId"];
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
