"use client";

import type React from "react";

import { clampTimelineEditorTime } from "../../time";
import type { TimelineEditorDocument, TimelineEditorMarker } from "../../types";
import {
  getTimelineEditorTimeFromPointer,
  getVisibleTimelineEditorTicks,
} from "../timeline-rendering";
import { timelineEditorRulerHeightPx, timelineEditorTrackHeaderWidthPx } from "./constants";
import type { TimelineEditorVisibleRange } from "./viewport";
import { isTimelineEditorTimeVisible } from "./viewport";

type TimelineEditorRulerProps<TTrackData, TItemData> = {
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
  nudgeMs: number;
  readOnly: boolean;
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
  setCurrentTime: (
    document: TimelineEditorDocument<TTrackData, TItemData>,
    timeMs: number,
    options: { durationMs: number; snapMs: number },
  ) => TimelineEditorDocument<TTrackData, TItemData>;
};

export function TimelineEditorRuler<TTrackData, TItemData>({
  document,
  durationMs,
  nudgeMs,
  readOnly,
  snapGuideMs,
  ticks,
  timelineWidthPx,
  visibleRange,
  onCurrentTimeChange,
  onDocumentChange,
  onMarkerPointerDown,
  setCurrentTime,
}: TimelineEditorRulerProps<TTrackData, TItemData>) {
  return (
    <>
      <div
        data-slot="timeline-editor-ruler"
        className="grid border-b bg-muted/40"
        style={{
          gridTemplateColumns: `${timelineEditorTrackHeaderWidthPx}px ${timelineWidthPx}px`,
          height: timelineEditorRulerHeightPx,
        }}
      >
        <div className="border-r bg-muted/20" />
        <div
          data-slot="timeline-editor-ruler-lane"
          className="relative"
          onPointerDown={(event) => {
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
