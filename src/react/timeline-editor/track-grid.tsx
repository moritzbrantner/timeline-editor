"use client";

import { useTimelineEditor } from "./provider";
import type { TimelineEditorTrackGridProps } from "./types";

export function TimelineEditorTrackGrid({
  durationMs: durationMsProp,
  ticks: ticksProp,
  timelineWidthPx: timelineWidthPxProp,
}: TimelineEditorTrackGridProps = {}) {
  const editor = useTimelineEditor();
  const durationMs = durationMsProp ?? editor.durationMs;
  const ticks = ticksProp ?? editor.ticks;
  const timelineWidthPx = timelineWidthPxProp ?? editor.timelineWidthPx;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {ticks.map((tick) => (
        <span
          key={tick.timeMs}
          data-slot="timeline-editor-track-tick"
          className={`absolute inset-y-0 border-l ${
            tick.major ? "border-border/70" : "border-border/35"
          }`}
          style={{ left: `${(tick.timeMs / durationMs) * timelineWidthPx}px` }}
        />
      ))}
    </div>
  );
}
