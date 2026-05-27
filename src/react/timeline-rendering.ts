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
  frameDurationMs?: number,
) {
  const safeDurationMs = Math.max(0, durationMs);
  const stepMs = getVisibleTimelineEditorTickStepMs(safeDurationMs, viewport, frameDurationMs);
  const startMs = Math.max(0, Math.floor(range.startMs / stepMs) * stepMs);
  const endMs = Math.min(safeDurationMs, Math.ceil(range.endMs / stepMs) * stepMs);
  const ticks = [];
  const majorEvery =
    frameDurationMs && frameDurationMs > 0
      ? Math.max(1, Math.ceil(64 / Math.max(1, (stepMs / 1_000) * viewport.pixelsPerSecond)))
      : 5;

  for (let timeMs = startMs; timeMs <= endMs + 0.0001; timeMs += stepMs) {
    const tickIndex = Math.round(timeMs / stepMs);

    ticks.push({
      timeMs,
      label: formatTimelineEditorTimeMs(timeMs),
      major: tickIndex % majorEvery === 0,
    });
  }

  return ticks;
}

function getVisibleTimelineEditorTickStepMs(
  durationMs: number,
  viewport: TimelineEditorViewport,
  frameDurationMs?: number,
) {
  if (Number.isFinite(frameDurationMs) && frameDurationMs !== undefined && frameDurationMs > 0) {
    const frameWidthPx = (frameDurationMs / 1_000) * viewport.pixelsPerSecond;
    const framesPerTick = Math.max(1, Math.ceil(8 / Math.max(frameWidthPx, 0.0001)));

    return Math.max(1, frameDurationMs * framesPerTick);
  }

  const intervalMs = viewport.pixelsPerSecond >= 120 ? 500 : undefined;

  return Math.max(
    1,
    intervalMs ??
      (durationMs <= 10_000
        ? 500
        : durationMs <= 60_000
          ? 1_000
          : durationMs <= 5 * 60_000
            ? 5_000
            : 30_000),
  );
}
