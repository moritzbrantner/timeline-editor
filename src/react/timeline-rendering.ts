import type React from "react";

import {
  clampTimelineEditorTime,
  formatTimelineEditorTimeMs,
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

export function getVisibleTimelineEditorTicksForRange(
  durationMs: number,
  viewport: TimelineEditorViewport,
  range: { startMs: number; endMs: number },
) {
  const safeDurationMs = Math.max(0, durationMs);
  const intervalMs = viewport.pixelsPerSecond >= 120 ? 500 : undefined;
  const stepMs = Math.max(
    1,
    intervalMs ??
      (safeDurationMs <= 10_000
        ? 500
        : safeDurationMs <= 60_000
          ? 1_000
          : safeDurationMs <= 5 * 60_000
            ? 5_000
            : 30_000),
  );
  const startMs = Math.max(0, Math.floor(range.startMs / stepMs) * stepMs);
  const endMs = Math.min(safeDurationMs, Math.ceil(range.endMs / stepMs) * stepMs);
  const ticks = [];

  for (let timeMs = startMs; timeMs <= endMs + 0.0001; timeMs += stepMs) {
    ticks.push({
      timeMs,
      label: formatTimelineEditorTimeMs(timeMs),
      major: Math.round(timeMs / stepMs) % 5 === 0,
    });
  }

  return ticks;
}
