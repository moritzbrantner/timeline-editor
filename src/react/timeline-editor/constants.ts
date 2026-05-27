import type { TimelineEditorHotkeys } from "./types";

export const timelineEditorViewportOverscanMs = 2_000;
export const timelineEditorTrackHeaderWidthPx = 144;
export const timelineEditorRulerHeightPx = 40;
export const timelineEditorTrackGroupHeightPx = 36;
export const timelineEditorDefaultTrackHeightPx = 56;
export const timelineEditorMinPixelsPerSecond = 24;
export const timelineEditorMaxPixelsPerSecond = 240;

export const defaultTimelineEditorHotkeys: TimelineEditorHotkeys = {
  delete: "Delete",
  nudgeLeft: "ArrowLeft",
  nudgeRight: "ArrowRight",
  selectAll: "Mod+A",
  zoomIn: "Mod+=",
  zoomOut: "Mod+-",
};
