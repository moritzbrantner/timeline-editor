import type {
  TimelineEditorDocument,
  TimelineEditorItemKind,
  TimelineEditorTrack,
} from "../../core";
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

export function createTimelineWorkbenchTrackGroupId<TTrackData, TItemData, TGroupData>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  preferredId = "track-group",
) {
  const existingIds = new Set(document.groups?.map((group) => group.id));
  const slug =
    preferredId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "track-group";
  let index = (document.groups?.length ?? 0) + 1;
  let id = `${slug}-${index}`;

  while (existingIds.has(id)) {
    index += 1;
    id = `${slug}-${index}`;
  }

  return id;
}
