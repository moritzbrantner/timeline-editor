import type { TimelineEditorItemKind, TimelineEditorTrack } from "../../core";
import type { TimelineWorkbenchAsset } from "./types";

export function createTimelineWorkbenchTrack<TTrackData, TItemData>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  kind?: TimelineEditorItemKind,
) {
  const existingIds = new Set(tracks.map((track) => track.id));
  const idPrefix = kind ? `${slugTimelineWorkbenchKind(kind)}-track` : "track";
  let index = tracks.length + 1;
  let id = `${idPrefix}-${index}`;

  while (existingIds.has(id)) {
    index += 1;
    id = `${idPrefix}-${index}`;
  }

  return {
    id,
    label: kind ? `${formatTimelineWorkbenchTrackKind(kind)} Track ${index}` : `Track ${index}`,
    ...(kind ? { kind, acceptsItemKinds: [kind] } : {}),
    items: [],
  } satisfies TimelineEditorTrack<TTrackData, TItemData>;
}

export function formatTimelineWorkbenchTrackKind(kind: TimelineEditorItemKind) {
  return kind
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function slugTimelineWorkbenchKind(kind: TimelineEditorItemKind) {
  const slug = kind
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "typed";
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
