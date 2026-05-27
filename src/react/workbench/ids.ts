import type { TimelineEditorTrack } from "../../core";
import type { TimelineWorkbenchAsset } from "./types";

export function createTimelineWorkbenchTrack<TTrackData, TItemData>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
) {
  const existingIds = new Set(tracks.map((track) => track.id));
  let index = tracks.length + 1;
  let id = `timeline-${index}`;

  while (existingIds.has(id)) {
    index += 1;
    id = `timeline-${index}`;
  }

  return {
    id,
    label: `Timeline ${index}`,
    items: [],
  } satisfies TimelineEditorTrack<TTrackData, TItemData>;
}

export function createTimelineWorkbenchItemId<TAssetData>(
  asset: TimelineWorkbenchAsset<TAssetData>,
  createItemId?: (asset: TimelineWorkbenchAsset<TAssetData>) => string,
) {
  return createItemId?.(asset) ?? `${asset.id}-${Date.now()}`;
}

export function createTimelineWorkbenchMarkerId(
  timeMs: number,
  createMarkerId?: (timeMs: number) => string,
) {
  return createMarkerId?.(timeMs) ?? `marker-${Date.now()}`;
}
