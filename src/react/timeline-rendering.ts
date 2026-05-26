import type React from "react";

import {
  clampTimelineEditorTime,
  getTimelineEditorDurationMs,
  getTimelineEditorTicks,
} from "../time";
import { type TimelineEditorDocument, type TimelineEditorViewport } from "../types";

export function getTimelineEditorDurationForDocument<TTrackData, TItemData>(
  document: TimelineEditorDocument<TTrackData, TItemData>,
) {
  return document.durationMs ?? getTimelineEditorDurationMs(document.tracks, 30_000);
}

export function getTimelineEditorWidthPx(durationMs: number, pixelsPerSecond: number) {
  return Math.max((durationMs / 1_000) * pixelsPerSecond, 640);
}

export function getTimelineEditorItemStyle(
  startMs: number,
  durationMs: number,
  timelineWidthPx: number,
  durationMsForTimeline: number,
) {
  return {
    left: `${(startMs / durationMsForTimeline) * timelineWidthPx}px`,
    width: `${Math.max(32, (durationMs / durationMsForTimeline) * timelineWidthPx)}px`,
  };
}

export function getTimelineEditorTimeFromPointer(
  event: Pick<React.PointerEvent<HTMLElement>, "currentTarget" | "clientX">,
  durationMs: number,
) {
  const bounds = event.currentTarget.getBoundingClientRect();
  const x = clampTimelineEditorTime(event.clientX - bounds.left, 0, bounds.width);

  return (x / Math.max(1, bounds.width)) * durationMs;
}

export function getTimelineEditorTimeFromDelta(deltaX: number, pixelsPerSecond: number) {
  return (deltaX / Math.max(1, pixelsPerSecond)) * 1_000;
}

export function getVisibleTimelineEditorTicks(
  durationMs: number,
  viewport: TimelineEditorViewport,
) {
  const intervalMs = viewport.pixelsPerSecond >= 120 ? 500 : undefined;

  return getTimelineEditorTicks(durationMs, intervalMs);
}
