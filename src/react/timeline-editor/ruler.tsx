"use client";

import { cn } from "@moritzbrantner/ui";

import { TimelineEditorContextMenuTarget } from "./context-menu";
import { timelineEditorRulerHeightPx, timelineEditorTrackHeaderWidthPx } from "./constants";
import { TimelineEditorPlayhead, TimelineEditorSnapGuide } from "./overlays";
import { isTimelineEditorPrimaryPointerButton } from "./pointer";
import { useTimelineEditor } from "./provider";
import type { TimelineEditorRulerPublicProps } from "./types";
import { isTimelineEditorTimeVisible } from "./viewport";

export function TimelineEditorRuler({
  className,
  style,
  ...props
}: TimelineEditorRulerPublicProps = {}) {
  const editor = useTimelineEditor();
  const rulerLane = (
    <div
      data-slot="timeline-editor-ruler-lane"
      className="relative"
      onPointerDown={(event) => {
        if (event.defaultPrevented || !isTimelineEditorPrimaryPointerButton(event)) {
          return;
        }

        if (event.shiftKey) {
          editor.beginRangeSelection(event);
          return;
        }

        editor.beginTimelineScrub(event);
        editor.commitCurrentTimeAtClientX(event.clientX);
      }}
    >
      {editor.ticks.map((tick) => (
        <div
          key={tick.timeMs}
          className="absolute top-0 h-full border-l border-border"
          style={{ left: `${(tick.timeMs / editor.durationMs) * 100}%` }}
        >
          {tick.major ? (
            <span className="ml-1 text-[10px] text-muted-foreground">{tick.label}</span>
          ) : null}
        </div>
      ))}
      {editor.selection.range ? (
        <TimelineEditorRulerRangeOverlay
          durationMs={editor.durationMs}
          range={editor.selection.range}
          timelineWidthPx={editor.timelineWidthPx}
        />
      ) : null}
      {(editor.document.markers ?? [])
        .filter((marker) => isTimelineEditorTimeVisible(marker.timeMs, editor.visibleRange))
        .map((marker) => (
          <div
            key={marker.id}
            data-slot="timeline-editor-marker"
            className="absolute top-0 h-full border-l-2"
            style={{
              left: `${(marker.timeMs / editor.durationMs) * 100}%`,
              borderColor: marker.color ?? "var(--primary)",
            }}
            title={marker.label}
            onPointerDown={(event) => {
              if (editor.readOnly) {
                return;
              }

              event.stopPropagation();
              editor.beginMarkerDrag(marker, event);
            }}
          />
        ))}
    </div>
  );

  return (
    <>
      <div
        data-slot="timeline-editor-ruler"
        className={cn("sticky top-0 z-50 grid border-b bg-card shadow-sm", className)}
        style={{
          gridTemplateColumns: `${timelineEditorTrackHeaderWidthPx}px ${editor.timelineWidthPx}px`,
          height: timelineEditorRulerHeightPx,
          ...style,
        }}
        {...props}
      >
        <div className="border-r bg-card" />
        {editor.getTimelineContextMenuItems ? (
          <TimelineEditorContextMenuTarget
            contentProps={{ "data-slot": "timeline-editor-ruler-menu" }}
            getContext={(event) => editor.getTimelineContextMenuContext("ruler", event)}
            getItems={editor.getTimelineContextMenuItems}
          >
            {rulerLane}
          </TimelineEditorContextMenuTarget>
        ) : (
          rulerLane
        )}
      </div>
      <TimelineEditorPlayhead />
      <TimelineEditorSnapGuide />
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
