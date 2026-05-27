import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

import { clampTimelineEditorTime, getTimelineEditorItemEndMs } from "../../time";
import type { TimelineEditorItem, TimelineEditorViewport } from "../../types";
import {
  timelineEditorTrackHeaderWidthPx,
  timelineEditorMaxPixelsPerSecond,
  timelineEditorMinPixelsPerSecond,
  timelineEditorViewportOverscanMs,
} from "./constants";

export type TimelineEditorVisibleRange = {
  startMs: number;
  endMs: number;
};

export function resolveTimelineEditorViewport(viewport?: TimelineEditorViewport) {
  return {
    pixelsPerSecond: viewport?.pixelsPerSecond ?? 80,
    scrollLeftMs: viewport?.scrollLeftMs,
    visibleStartMs: viewport?.visibleStartMs,
    visibleEndMs: viewport?.visibleEndMs,
  } satisfies TimelineEditorViewport;
}

export function getTimelineEditorVisibleRange(
  durationMs: number,
  viewport: TimelineEditorViewport,
  measuredViewport: { scrollLeftPx: number; widthPx: number },
  timelineOffsetPx = 0,
): TimelineEditorVisibleRange {
  const pixelsPerSecond = Math.max(1, viewport.pixelsPerSecond);
  const measuredStartPx = Math.max(0, measuredViewport.scrollLeftPx - timelineOffsetPx);
  const measuredEndPx = Math.max(
    measuredStartPx,
    measuredViewport.scrollLeftPx + measuredViewport.widthPx - timelineOffsetPx,
  );
  const measuredStartMs = (measuredStartPx / pixelsPerSecond) * 1_000;
  const measuredDurationMs =
    measuredViewport.widthPx > 0
      ? ((measuredEndPx - measuredStartPx) / pixelsPerSecond) * 1_000
      : durationMs;
  const rawStartMs = viewport.visibleStartMs ?? viewport.scrollLeftMs ?? measuredStartMs;
  const rawEndMs = viewport.visibleEndMs ?? rawStartMs + measuredDurationMs;

  return {
    startMs: clampTimelineEditorTime(rawStartMs - timelineEditorViewportOverscanMs, 0, durationMs),
    endMs: clampTimelineEditorTime(rawEndMs + timelineEditorViewportOverscanMs, 0, durationMs),
  };
}

export function isTimelineEditorTimeVisible(timeMs: number, range: TimelineEditorVisibleRange) {
  return timeMs >= range.startMs && timeMs <= range.endMs;
}

export function getVisibleTimelineEditorItems<TItemData>(
  items: Array<TimelineEditorItem<TItemData>>,
  range: TimelineEditorVisibleRange,
  selectedIds: ReadonlySet<string>,
) {
  return items.filter(
    (item) =>
      selectedIds.has(item.id) ||
      (item.startMs <= range.endMs && getTimelineEditorItemEndMs(item) >= range.startMs),
  );
}

export function getNextTimelineEditorPixelsPerSecond(pixelsPerSecond: number, direction: number) {
  return clampTimelineEditorTime(
    pixelsPerSecond + direction * 16,
    timelineEditorMinPixelsPerSecond,
    timelineEditorMaxPixelsPerSecond,
  );
}

export function useTimelineEditorMeasuredViewport(
  scrollerRef: RefObject<HTMLDivElement | null>,
  pendingWheelZoomRef: RefObject<{ offsetX: number; timeMs: number } | null>,
  pixelsPerSecond: number,
) {
  const [measuredViewport, setMeasuredViewport] = useState({
    scrollLeftPx: 0,
    widthPx: 1024,
  });

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    const updateMeasuredViewport = () => {
      setMeasuredViewport({
        scrollLeftPx: scroller.scrollLeft,
        widthPx: scroller.clientWidth,
      });
    };

    updateMeasuredViewport();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateMeasuredViewport);
    observer.observe(scroller);

    return () => {
      observer.disconnect();
    };
  }, [scrollerRef]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const pendingWheelZoom = pendingWheelZoomRef.current;

    if (!scroller || !pendingWheelZoom) {
      return;
    }

    pendingWheelZoomRef.current = null;
    const nextScrollLeft = clampTimelineEditorTime(
      timelineEditorTrackHeaderWidthPx +
        (pendingWheelZoom.timeMs / 1_000) * pixelsPerSecond -
        pendingWheelZoom.offsetX,
      0,
      Math.max(0, scroller.scrollWidth - scroller.clientWidth),
    );
    scroller.scrollLeft = nextScrollLeft;
    setMeasuredViewport({
      scrollLeftPx: nextScrollLeft,
      widthPx: scroller.clientWidth,
    });
  }, [pixelsPerSecond, pendingWheelZoomRef, scrollerRef]);

  return [measuredViewport, setMeasuredViewport] as const;
}
