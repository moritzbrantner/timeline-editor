"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createTimelineEditorDocumentIndex,
  getTimelineEditorGroupedItemIdsFromIndex,
} from "../../document-index";
import {
  createTimelineEditorSnapOptions,
  createTimelineEditorSnapResolver,
  getTimelineEditorFrameDurationMs,
  getTimelineEditorItemEndMs,
  clampTimelineEditorTime,
  snapTimelineEditorTime,
} from "../../time";
import {
  defaultTimelineEditorSelection,
  defaultTimelineEditorSnapMs,
  type TimelineEditorItem,
  type TimelineEditorMarker,
  type TimelineEditorTrack,
} from "../../types";
import {
  normalizeTimelineEditorDocument,
  setTimelineEditorCurrentTime,
  splitTimelineEditorItems,
  updateTimelineEditorMarker,
} from "../../core";
import {
  getTimelineEditorDurationForDocument,
  getTimelineEditorTimeFromDelta,
  getTimelineEditorWidthPx,
  getVisibleTimelineEditorTicksForRange,
} from "../timeline-rendering";
import { defaultTimelineEditorHotkeys, timelineEditorTrackHeaderWidthPx } from "./constants";
import { getTimelineEditorNudgeMs } from "./hotkeys";
import {
  getTimelineEditorDragCommitTracks,
  getTimelineEditorEventTrackId,
  getTimelineEditorMoveDragTracks,
  getTimelineEditorNativeEventTrackId,
  getTimelineEditorResizeDragTracks,
  getTimelineEditorTimeAtClientX,
  getTimelineEditorWheelDeltaPx,
  normalizeTimelineEditorDragRange,
  type TimelineEditorSnapResolver,
} from "./interactions";
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
import type {
  TimelineEditorContextValue,
  TimelineEditorDragState,
  TimelineEditorProviderProps,
  TimelineEditorTimelineContextMenuContext,
} from "./types";
import {
  getNextTimelineEditorPixelsPerSecond,
  getTimelineEditorScrollLeftMs,
  getTimelineEditorVisibleRange,
  resolveTimelineEditorViewport,
  useTimelineEditorMeasuredViewport,
} from "./viewport";

const TimelineEditorContext = createContext<unknown>(null);

export function useTimelineEditor<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>() {
  const context = useContext(TimelineEditorContext);

  if (!context) {
    throw new Error("useTimelineEditor must be used within a TimelineEditorProvider.");
  }

  return context as TimelineEditorContextValue<TTrackData, TItemData>;
}

export function useOptionalTimelineEditor<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>() {
  return useContext(TimelineEditorContext) as TimelineEditorContextValue<
    TTrackData,
    TItemData
  > | null;
}

export function TimelineEditorProvider<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>({
  children,
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
  followCurrentTime = "off",
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
}: TimelineEditorProviderProps<TTrackData, TItemData>) {
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

  const getTimeAtClientX = useCallback(
    (clientX: number) =>
      getTimelineEditorTimeAtClientX(
        clientX,
        scrollerRef.current,
        resolvedViewport.pixelsPerSecond,
        durationMs,
      ),
    [durationMs, resolvedViewport.pixelsPerSecond],
  );

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

  const commitCurrentTimeAtClientX = useCallback(
    (clientX: number) => {
      const timeMs = getTimeAtClientX(clientX);
      const nextDocument = setTimelineEditorCurrentTime(document, timeMs, {
        durationMs,
        snapMs: nudgeMs,
      });

      onCurrentTimeChange?.(nextDocument.currentTimeMs ?? 0);

      if (nextDocument !== document) {
        commitDocument(nextDocument);
      }
    },
    [commitDocument, document, durationMs, getTimeAtClientX, nudgeMs, onCurrentTimeChange],
  );

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
  };

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller || followCurrentTime !== "keep-visible" || durationMs <= 0) {
      return;
    }

    const playheadX =
      timelineEditorTrackHeaderWidthPx +
      (clampTimelineEditorTime(document.currentTimeMs ?? 0, 0, durationMs) / durationMs) *
        timelineWidthPx;
    const marginPx = 64;
    const safeLeft = scroller.scrollLeft + marginPx;
    const safeRight = scroller.scrollLeft + scroller.clientWidth - marginPx;
    let nextScrollLeft = scroller.scrollLeft;

    if (playheadX < safeLeft) {
      nextScrollLeft = playheadX - marginPx;
    } else if (playheadX > safeRight) {
      nextScrollLeft = playheadX - scroller.clientWidth + marginPx;
    }

    nextScrollLeft = clampTimelineEditorTime(
      nextScrollLeft,
      0,
      Math.max(0, scroller.scrollWidth - scroller.clientWidth),
    );

    if (Math.abs(scroller.scrollLeft - nextScrollLeft) < 1) {
      return;
    }

    scroller.scrollLeft = nextScrollLeft;
    setMeasuredViewport({
      scrollLeftPx: nextScrollLeft,
      scrollTopPx: scroller.scrollTop,
      widthPx: scroller.clientWidth,
      heightPx: scroller.clientHeight,
    });
    onViewportChange?.({
      ...resolvedViewport,
      scrollLeftMs: getTimelineEditorScrollLeftMs(
        nextScrollLeft,
        resolvedViewport.pixelsPerSecond,
        durationMs,
      ),
    });
  }, [
    document.currentTimeMs,
    durationMs,
    followCurrentTime,
    measuredViewport.widthPx,
    onViewportChange,
    resolvedViewport,
    setMeasuredViewport,
    timelineWidthPx,
  ]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
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

      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        !trackId ||
        (event.target instanceof Element &&
          (event.target.closest("[data-slot='timeline-editor-clip']") ||
            event.target.closest("[data-slot='timeline-editor-track-header']")))
      ) {
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

  const beginMarkerDrag = (
    marker: TimelineEditorMarker,
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
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
  };

  const beginClipMove = (
    item: TimelineEditorItem<TItemData>,
    track: TimelineEditorTrack<TTrackData, TItemData>,
    locked: boolean,
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (locked || event.button !== 0) {
      return;
    }

    event.stopPropagation();

    if (tool === "blade") {
      const timeMs = getTimeAtClientX(event.clientX);
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
        commitDocument(normalizeTimelineEditorDocument({ ...document, tracks }, { durationMs }));
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
  };

  const beginClipResize = (
    edge: "start" | "end",
    item: TimelineEditorItem<TItemData>,
    locked: boolean,
    event: React.PointerEvent<HTMLSpanElement>,
  ) => {
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
  };

  const value = useMemo(
    () =>
      ({
        beginClipMove,
        beginClipResize,
        beginMarkerDrag,
        beginRangeSelection,
        beginTimelineScrub,
        cancelDrag,
        clearMouseInteraction,
        clearPreview,
        commitCurrentTimeAtClientX,
        commitDocument,
        commitDrag,
        commitSelection,
        document,
        documentIndex,
        durationMs,
        editorWidthPx,
        frameDurationMs,
        getItemContextMenuItems,
        getTimelineContextMenuContext,
        getTimelineContextMenuItems,
        getTrackContextMenuItems,
        handleKeyDown,
        handleMouseDownCapture,
        handleMouseMove,
        handlePointerDown,
        handlePointerDownCapture,
        handlePointerMove,
        handleScroll,
        measuredViewport,
        nudgeMs,
        previewTracks,
        readOnly,
        renderDocument,
        renderItem,
        renderTrackGroupHeader,
        renderTrackHeader,
        resolvedHotkeys,
        resolvedSnap,
        schedulePreviewUpdate,
        scrollerRef,
        selectItem,
        selectedIds,
        selectedItems,
        selection,
        snapGuideMs,
        ticks,
        timelineWidthPx,
        tool,
        viewport: resolvedViewport,
        virtualization: resolvedVirtualization,
        visibleRange,
        visibleTracks,
      }) satisfies TimelineEditorContextValue<TTrackData, TItemData>,
    [
      beginClipMove,
      beginClipResize,
      beginMarkerDrag,
      beginRangeSelection,
      beginTimelineScrub,
      cancelDrag,
      clearPreview,
      commitCurrentTimeAtClientX,
      commitDocument,
      commitDrag,
      commitSelection,
      document,
      documentIndex,
      durationMs,
      editorWidthPx,
      frameDurationMs,
      getItemContextMenuItems,
      getTimelineContextMenuItems,
      getTrackContextMenuItems,
      handleKeyDown,
      measuredViewport,
      nudgeMs,
      previewTracks,
      readOnly,
      renderDocument,
      renderItem,
      renderTrackGroupHeader,
      renderTrackHeader,
      resolvedHotkeys,
      resolvedSnap,
      resolvedVirtualization,
      schedulePreviewUpdate,
      selectedIds,
      selectedItems,
      selection,
      snapGuideMs,
      ticks,
      timelineWidthPx,
      tool,
      resolvedViewport,
      visibleRange,
      visibleTracks,
    ],
  );

  return <TimelineEditorContext.Provider value={value}>{children}</TimelineEditorContext.Provider>;
}
