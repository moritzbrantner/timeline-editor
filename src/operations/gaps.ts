import type { TimelineEditorOperationOptions, TimelineEditorTrack } from "../types";
import { normalizeTimelineEditorTracks } from "./normalize";

export function closeTimelineEditorGap<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  trackId: string,
  startMs: number,
  endMs: number,
  options: TimelineEditorOperationOptions = {},
) {
  const gapMs = Math.max(0, endMs - startMs);

  if (gapMs === 0) {
    return tracks;
  }

  return normalizeTimelineEditorTracks(
    tracks.map((track) =>
      track.id !== trackId || track.locked
        ? track
        : {
            ...track,
            items: track.items.map((item) =>
              item.startMs >= endMs && !item.locked
                ? { ...item, startMs: Math.max(startMs, item.startMs - gapMs) }
                : item,
            ),
          },
    ),
    options,
  );
}

export function insertTimelineEditorGap<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  trackId: string,
  startMs: number,
  durationMs: number,
  options: TimelineEditorOperationOptions = {},
) {
  const gapMs = Math.max(0, durationMs);

  if (gapMs === 0) {
    return tracks;
  }

  return normalizeTimelineEditorTracks(
    tracks.map((track) =>
      track.id !== trackId || track.locked
        ? track
        : {
            ...track,
            items: track.items.map((item) =>
              item.startMs >= startMs && !item.locked
                ? { ...item, startMs: item.startMs + gapMs }
                : item,
            ),
          },
    ),
    options,
  );
}
