import { clampTimelineEditorTime, snapTimelineEditorTime } from "../time";
import type {
  TimelineEditorDocument,
  TimelineEditorMarker,
  TimelineEditorOperationOptions,
} from "../types";
import { normalizeTimelineEditorDocument } from "./normalize";
import { getSnapMs } from "./snap";

export function setTimelineEditorCurrentTime<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  timeMs: number,
  options: TimelineEditorOperationOptions = {},
) {
  const durationMs = options.durationMs ?? document.durationMs ?? Number.POSITIVE_INFINITY;
  const currentTimeMs = clampTimelineEditorTime(
    snapTimelineEditorTime(timeMs, getSnapMs(options)),
    0,
    durationMs,
  );

  return currentTimeMs === document.currentTimeMs ? document : { ...document, currentTimeMs };
}

export function setTimelineEditorMarkers<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  markers: TimelineEditorMarker[],
  options: TimelineEditorOperationOptions = {},
) {
  return normalizeTimelineEditorDocument({ ...document, markers }, options);
}

export function addTimelineEditorMarker<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  marker: TimelineEditorMarker,
  options: TimelineEditorOperationOptions = {},
) {
  if ((document.markers ?? []).some((candidate) => candidate.id === marker.id)) {
    return document;
  }

  return setTimelineEditorMarkers(document, [...(document.markers ?? []), marker], options);
}

export function updateTimelineEditorMarker<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  markerId: string,
  patch: Partial<TimelineEditorMarker>,
  options: TimelineEditorOperationOptions = {},
) {
  const markers = document.markers ?? [];

  if (!markers.some((marker) => marker.id === markerId)) {
    return document;
  }

  return setTimelineEditorMarkers(
    document,
    markers.map((marker) => (marker.id === markerId ? updateMarker(marker, patch) : marker)),
    options,
  );
}

export function removeTimelineEditorMarker<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>, markerId: string) {
  const markers = document.markers ?? [];

  if (!markers.some((marker) => marker.id === markerId)) {
    return document;
  }

  return {
    ...document,
    markers: markers.filter((marker) => marker.id !== markerId),
  };
}

export function updateMarker(marker: TimelineEditorMarker, patch: Partial<TimelineEditorMarker>) {
  return { ...marker, ...patch, id: marker.id };
}
