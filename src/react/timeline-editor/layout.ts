import {
  timelineEditorDefaultTrackHeightPx,
  timelineEditorRulerHeightPx,
  timelineEditorTrackGroupHeightPx,
} from "./constants";
import type { TimelineEditorMeasuredViewport } from "./viewport";
import type {
  TimelineEditorTrackEntry,
  TimelineEditorTrackRowModel,
  TimelineEditorVirtualizationOptions,
} from "./types";

export function getTimelineEditorTrackRows<TTrackData, TItemData>(
  visibleTracks: Array<TimelineEditorTrackEntry<TTrackData, TItemData>>,
) {
  const rows: Array<TimelineEditorTrackRowModel<TTrackData, TItemData>> = [];
  let topPx = 0;

  for (const entry of visibleTracks) {
    const heightPx =
      entry.type === "group"
        ? timelineEditorTrackGroupHeightPx
        : (entry.track.height ?? timelineEditorDefaultTrackHeightPx);

    rows.push({ entry, topPx, heightPx });
    topPx += heightPx;
  }

  return rows;
}

export function getRenderedTimelineEditorTrackRows<TTrackData, TItemData>(
  rows: Array<TimelineEditorTrackRowModel<TTrackData, TItemData>>,
  measuredViewport: TimelineEditorMeasuredViewport,
  virtualization: Required<TimelineEditorVirtualizationOptions>,
) {
  const totalHeightPx = rows.at(-1) ? rows.at(-1)!.topPx + rows.at(-1)!.heightPx : 0;
  const viewportStartPx = Math.max(0, measuredViewport.scrollTopPx - timelineEditorRulerHeightPx);
  const viewportHeightPx = Math.max(0, measuredViewport.heightPx);
  const shouldVirtualizeRows =
    virtualization.rows === true ||
    (virtualization.rows === "auto" && viewportHeightPx > 0 && totalHeightPx > viewportHeightPx);
  const renderedRows = shouldVirtualizeRows
    ? rows.filter(
        (row) =>
          row.topPx + row.heightPx >= viewportStartPx - virtualization.rowOverscanPx &&
          row.topPx <= viewportStartPx + viewportHeightPx + virtualization.rowOverscanPx,
      )
    : rows;

  return { renderedRows, shouldVirtualizeRows, totalHeightPx };
}
