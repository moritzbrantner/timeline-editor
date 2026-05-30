"use client";

import { clampTimelineEditorTime, formatTimelineEditorTimeMs } from "../../time";
import { timelineEditorTrackHeaderWidthPx } from "./constants";
import { useTimelineEditor } from "./provider";
import type {
  TimelineEditorLiveRegionProps,
  TimelineEditorPlayheadProps,
  TimelineEditorRangeOverlayProps,
  TimelineEditorSnapFeedbackProps,
  TimelineEditorSnapGuideProps,
} from "./types";

export function TimelineEditorRangeOverlay({
  durationMs: durationMsProp,
  range,
  timelineWidthPx: timelineWidthPxProp,
}: TimelineEditorRangeOverlayProps) {
  const editor = useTimelineEditor();
  const durationMs = durationMsProp ?? editor.durationMs;
  const timelineWidthPx = timelineWidthPxProp ?? editor.timelineWidthPx;
  const startMs = Math.max(0, Math.min(range.startMs, range.endMs));
  const endMs = Math.max(startMs, Math.max(range.startMs, range.endMs));
  const leftPx = (startMs / durationMs) * timelineWidthPx;
  const widthPx = Math.max(1, ((endMs - startMs) / durationMs) * timelineWidthPx);

  return (
    <div
      data-slot="timeline-editor-range-overlay"
      className="pointer-events-none absolute inset-y-0 z-10 border-x border-primary/60 bg-primary/15"
      style={{ left: leftPx, width: widthPx }}
    />
  );
}

export function TimelineEditorPlayhead({ style, ...props }: TimelineEditorPlayheadProps = {}) {
  const { document, durationMs, timelineWidthPx } = useTimelineEditor();

  return (
    <div
      data-slot="timeline-editor-playhead"
      className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-primary"
      style={{
        left: `${timelineEditorTrackHeaderWidthPx + (clampTimelineEditorTime(document.currentTimeMs ?? 0, 0, durationMs) / durationMs) * timelineWidthPx}px`,
        ...style,
      }}
      {...props}
    />
  );
}

export function TimelineEditorSnapGuide({ style, ...props }: TimelineEditorSnapGuideProps = {}) {
  const { durationMs, snapGuideMs, timelineWidthPx } = useTimelineEditor();

  if (snapGuideMs === null) {
    return null;
  }

  return (
    <div
      data-slot="timeline-editor-snap-guide"
      className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-ring"
      style={{
        left: `${timelineEditorTrackHeaderWidthPx + (snapGuideMs / durationMs) * timelineWidthPx}px`,
        ...style,
      }}
      {...props}
    />
  );
}

export function TimelineEditorSnapFeedback({
  style,
  ...props
}: TimelineEditorSnapFeedbackProps = {}) {
  const { durationMs, snapGuideMs, timelineWidthPx } = useTimelineEditor();

  if (snapGuideMs === null) {
    return null;
  }

  return (
    <div
      data-slot="timeline-editor-snap-feedback"
      aria-hidden="true"
      className="pointer-events-none absolute bottom-0 top-9 z-20 border-l-2 border-primary/80"
      style={{
        left:
          timelineEditorTrackHeaderWidthPx +
          (snapGuideMs / Math.max(1, durationMs)) * timelineWidthPx,
        ...style,
      }}
      {...props}
    >
      <span
        data-slot="timeline-editor-snap-feedback-label"
        className="absolute left-1 top-1 whitespace-nowrap rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-foreground shadow-sm"
      >
        {formatTimelineEditorTimeMs(snapGuideMs)}
      </span>
    </div>
  );
}

export function TimelineEditorLiveRegion(props: TimelineEditorLiveRegionProps = {}) {
  const { selection } = useTimelineEditor();

  return (
    <span className="sr-only" aria-live="polite" {...props}>
      {selection.itemIds.length > 0
        ? `${selection.itemIds.length} timeline items selected`
        : "No timeline items selected"}
    </span>
  );
}
