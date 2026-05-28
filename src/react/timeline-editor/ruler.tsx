"use client";

import type React from "react";

import { clampTimelineEditorTime } from "../../time";
import type {
  TimelineEditorDocument,
  TimelineEditorMarker,
  TimelineEditorSelection,
} from "../../types";
import {
  getTimelineEditorTimeFromPointer,
  getVisibleTimelineEditorTicks,
} from "../timeline-rendering";
import { TimelineEditorContextMenuTarget } from "./context-menu";
import { timelineEditorRulerHeightPx, timelineEditorTrackHeaderWidthPx } from "./constants";
import { isTimelineEditorPrimaryPointerButton } from "./pointer";
import type {
  TimelineEditorTimelineContextMenuContext,
  TimelineEditorTimelineContextMenuItems,
} from "./types";
import type { TimelineEditorVisibleRange } from "./viewport";
import { isTimelineEditorTimeVisible } from "./viewport";

type TimelineEditorRulerProps<TTrackData extends Record<string, unknown>, TItemData> = {
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
  nudgeMs: number;
  readOnly: boolean;
  selection: TimelineEditorSelection;
  getTimelineContextMenuContext?: (
    event: React.MouseEvent<Element>,
  ) => TimelineEditorTimelineContextMenuContext<TTrackData, TItemData>;
  getTimelineContextMenuItems?: TimelineEditorTimelineContextMenuItems<TTrackData, TItemData>;
  snapGuideMs: number | null;
  ticks: ReturnType<typeof getVisibleTimelineEditorTicks>;
  timelineWidthPx: number;
  visibleRange: TimelineEditorVisibleRange;
  onCurrentTimeChange?: (timeMs: number) => void;
  onDocumentChange: (document: TimelineEditorDocument<TTrackData, TItemData>) => void;
  onMarkerPointerDown?: (
    marker: TimelineEditorMarker,
    event: React.PointerEvent<HTMLDivElement>,
  ) => void;
  onRangePointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onScrubPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  setCurrentTime: (
    document: TimelineEditorDocument<TTrackData, TItemData>,
    timeMs: number,
    options: { durationMs: number; snapMs: number },
  ) => TimelineEditorDocument<TTrackData, TItemData>;
};

export function TimelineEditorRuler<TTrackData extends Record<string, unknown>, TItemData>({
  document,
  durationMs,
  getTimelineContextMenuContext,
  getTimelineContextMenuItems,
  nudgeMs,
  readOnly,
  selection,
  snapGuideMs,
  ticks,
  timelineWidthPx,
  visibleRange,
  onCurrentTimeChange,
  onDocumentChange,
  onMarkerPointerDown,
  onRangePointerDown,
  onScrubPointerDown,
  setCurrentTime,
}: TimelineEditorRulerProps<TTrackData, TItemData>) {
  const rulerLane = (
    <div
      data-slot="timeline-editor-ruler-lane"
      className="relative"
      onPointerDown={(event) => {
        if (event.defaultPrevented || !isTimelineEditorPrimaryPointerButton(event)) {
          return;
        }

        if (event.shiftKey) {
          onRangePointerDown?.(event);
          return;
        }

        onScrubPointerDown?.(event);
        const timeMs = getTimelineEditorTimeFromPointer(event, durationMs);
        const nextDocument = setCurrentTime(document, timeMs, {
          durationMs,
          snapMs: nudgeMs,
        });
        onCurrentTimeChange?.(nextDocument.currentTimeMs ?? 0);
        onDocumentChange(nextDocument);
      }}
    >
      {ticks.map((tick) => (
        <div
          key={tick.timeMs}
          className="absolute top-0 h-full border-l border-border"
          style={{ left: `${(tick.timeMs / durationMs) * 100}%` }}
        >
          {tick.major ? (
            <span className="ml-1 text-[10px] text-muted-foreground">{tick.label}</span>
          ) : null}
        </div>
      ))}
      {selection.range ? (
        <TimelineEditorRulerRangeOverlay
          durationMs={durationMs}
          range={selection.range}
          timelineWidthPx={timelineWidthPx}
        />
      ) : null}
      {(document.markers ?? [])
        .filter((marker) => isTimelineEditorTimeVisible(marker.timeMs, visibleRange))
        .map((marker) => (
          <div
            key={marker.id}
            data-slot="timeline-editor-marker"
            className="absolute top-0 h-full border-l-2"
            style={{
              left: `${(marker.timeMs / durationMs) * 100}%`,
              borderColor: marker.color ?? "var(--primary)",
            }}
            title={marker.label}
            onPointerDown={(event) => {
              if (readOnly) {
                return;
              }

              event.stopPropagation();
              onMarkerPointerDown?.(marker, event);
            }}
          />
        ))}
    </div>
  );

  return (
    <>
      <div
        data-slot="timeline-editor-ruler"
        className="sticky top-0 z-50 grid border-b bg-card shadow-sm"
        style={{
          gridTemplateColumns: `${timelineEditorTrackHeaderWidthPx}px ${timelineWidthPx}px`,
          height: timelineEditorRulerHeightPx,
        }}
      >
        <div className="border-r bg-card" />
        {getTimelineContextMenuContext ? (
          <TimelineEditorContextMenuTarget
            contentProps={{ "data-slot": "timeline-editor-ruler-menu" }}
            getContext={getTimelineContextMenuContext}
            getItems={getTimelineContextMenuItems}
          >
            {rulerLane}
          </TimelineEditorContextMenuTarget>
        ) : (
          rulerLane
        )}
      </div>
      <div
        data-slot="timeline-editor-playhead"
        className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-primary"
        style={{
          left: `${timelineEditorTrackHeaderWidthPx + (clampTimelineEditorTime(document.currentTimeMs ?? 0, 0, durationMs) / durationMs) * timelineWidthPx}px`,
        }}
      />
      {snapGuideMs !== null ? (
        <div
          data-slot="timeline-editor-snap-guide"
          className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-ring"
          style={{
            left: `${timelineEditorTrackHeaderWidthPx + (snapGuideMs / durationMs) * timelineWidthPx}px`,
          }}
        />
      ) : null}
    </>
  );
}

function TimelineEditorRulerRangeOverlay({
  durationMs,
  range,
  timelineWidthPx,
}: {
  durationMs: number;
  range: { startMs: number; endMs: number };
  timelineWidthPx: number;
}) {
  const startMs = Math.max(0, Math.min(range.startMs, range.endMs));
  const endMs = Math.max(startMs, Math.max(range.startMs, range.endMs));
  const leftPx = (startMs / durationMs) * timelineWidthPx;
  const widthPx = Math.max(1, ((endMs - startMs) / durationMs) * timelineWidthPx);

  return (
    <div
      data-slot="timeline-editor-ruler-range-overlay"
      className="pointer-events-none absolute inset-y-0 border-x border-primary/70 bg-primary/20"
      style={{ left: leftPx, width: widthPx }}
    />
  );
}
