"use client";

import { useLayoutEffect, useRef } from "react";

import {
  formatTimelineEditorTimeMs,
  type TimelineEditorDocument,
  type TimelineEditorItem,
  type TimelineEditorTrack,
} from "../../core";
import type { TimelineWorkbenchPreviewMode } from "./types";

export function TimelineWorkbenchMiniPreview<
  TTrackData extends Record<string, unknown>,
  TItemData,
>({
  currentTimeMs,
  document,
  durationMs,
}: {
  currentTimeMs: number;
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const safeDurationMs = Math.max(1, durationMs);
  const timelineWidthPx = Math.max(480, (safeDurationMs / 1_000) * 64);
  const playheadLeftPx = Math.min(
    timelineWidthPx,
    Math.max(0, (currentTimeMs / safeDurationMs) * timelineWidthPx),
  );

  useLayoutEffect(() => {
    const scroller = scrollRef.current;

    if (!scroller) {
      return;
    }

    const marginPx = 48;
    const safeLeft = scroller.scrollLeft + marginPx;
    const safeRight = scroller.scrollLeft + scroller.clientWidth - marginPx;
    let nextScrollLeft = scroller.scrollLeft;

    if (playheadLeftPx < safeLeft) {
      nextScrollLeft = playheadLeftPx - marginPx;
    } else if (playheadLeftPx > safeRight) {
      nextScrollLeft = playheadLeftPx - scroller.clientWidth + marginPx;
    }

    nextScrollLeft = Math.max(
      0,
      Math.min(nextScrollLeft, Math.max(0, scroller.scrollWidth - scroller.clientWidth)),
    );

    if (Math.abs(scroller.scrollLeft - nextScrollLeft) >= 1) {
      scroller.scrollLeft = nextScrollLeft;
    }
  }, [playheadLeftPx]);

  if (document.tracks.length === 0) {
    return (
      <div
        data-slot="timeline-workbench-mini-preview"
        className="grid h-full place-items-center p-4 text-center text-white"
      >
        <div className="text-sm font-medium">
          0 tracks · {formatTimelineEditorTimeMs(currentTimeMs)} /{" "}
          {formatTimelineEditorTimeMs(durationMs)}
        </div>
      </div>
    );
  }

  return (
    <div
      data-slot="timeline-workbench-mini-preview"
      className="grid h-full min-h-0 text-white"
      style={{ gridTemplateColumns: "96px minmax(0, 1fr)" }}
    >
      <div className="overflow-hidden border-r border-white/10 pt-4">
        {document.tracks.map((track) => (
          <div
            key={track.id}
            data-slot="timeline-workbench-mini-preview-label"
            className="flex h-9 items-center truncate border-b border-white/10 px-3 text-xs text-white/70"
            title={track.label}
          >
            {track.label}
          </div>
        ))}
      </div>
      <div ref={scrollRef} className="min-w-0 overflow-x-auto overflow-y-hidden pt-4">
        <div className="relative" style={{ width: timelineWidthPx }}>
          <div
            data-slot="timeline-workbench-mini-preview-playhead"
            className="absolute top-0 bottom-0 z-20 w-px bg-primary"
            style={{ left: playheadLeftPx }}
          />
          {document.tracks.map((track) => (
            <div
              key={track.id}
              data-slot="timeline-workbench-mini-preview-row"
              className="relative h-9 border-b border-white/10"
            >
              {track.items.map((item) => (
                <div
                  key={item.id}
                  data-slot="timeline-workbench-mini-preview-item"
                  className="absolute top-2 h-4 rounded-sm border border-white/10"
                  title={item.label}
                  style={{
                    left: `${Math.max(0, (item.startMs / safeDurationMs) * timelineWidthPx)}px`,
                    width: `${Math.max(2, (item.durationMs / safeDurationMs) * timelineWidthPx)}px`,
                    background: item.color ?? "hsl(var(--primary))",
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function getTimelineWorkbenchPreviewItems<
  TTrackData extends Record<string, unknown>,
  TItemData,
>(
  mode: TimelineWorkbenchPreviewMode,
  document: TimelineEditorDocument<TTrackData, TItemData>,
  selectedItems: Array<TimelineEditorItem<TItemData>>,
  activeItems: Array<{
    item: TimelineEditorItem<TItemData>;
    track: TimelineEditorTrack<TTrackData, TItemData>;
  }>,
) {
  if (mode === "selection-first" && selectedItems.length > 0) {
    return selectedItems.map((item) => ({
      item,
      track: document.tracks.find((track) => track.id === item.trackId),
    }));
  }

  return activeItems;
}
