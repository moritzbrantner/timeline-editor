import type {
  TimelineEditorOperationOptions,
  TimelineEditorTrack,
  TimelineEditorTransform,
  TimelineEditorTransformPoint,
  TimelineEditorTransformPointPatch,
  TimelineEditorTransformValues,
} from "../types";
import { normalizeTimelineEditorTransform } from "../transform";
import { findTimelineEditorItem } from "./find";
import { normalizeTimelineEditorTracks } from "./normalize";

export function setTimelineEditorItemTransform<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TTransformValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData, TTransformValues>>,
  itemId: string,
  transform: TimelineEditorTransform<TTransformValues> | undefined,
  options: TimelineEditorOperationOptions = {},
) {
  const found = findTimelineEditorItem(tracks, itemId);

  if (!found || found.item.locked || found.track.locked) {
    return tracks;
  }

  return normalizeTimelineEditorTracks(
    tracks.map((track) =>
      track.id === found.track.id
        ? {
            ...track,
            items: track.items.map((item) => (item.id === itemId ? { ...item, transform } : item)),
          }
        : track,
    ),
    options,
  );
}

export function upsertTimelineEditorTransformPoint<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TTransformValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData, TTransformValues>>,
  itemId: string,
  point: TimelineEditorTransformPoint<TTransformValues>,
  options: TimelineEditorOperationOptions = {},
) {
  return updateTimelineEditorItemTransform(tracks, itemId, options, (transform, durationMs) => {
    const nextPoint = normalizeTimelineEditorTransform({ points: [point] }, durationMs).points[0];

    if (!nextPoint) {
      return transform;
    }

    const points = transform.points.filter(
      (candidate) => candidate.offsetMs !== nextPoint.offsetMs,
    );

    points.push({
      ...transform.points.find((candidate) => candidate.offsetMs === nextPoint.offsetMs),
      ...nextPoint,
      easing: nextPoint.easing,
      values: {
        ...(transform.points.find((candidate) => candidate.offsetMs === nextPoint.offsetMs)
          ?.values ?? {}),
        ...nextPoint.values,
      },
    });

    return normalizeTimelineEditorTransform({ ...transform, points }, durationMs);
  });
}

export function updateTimelineEditorTransformPoint<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TTransformValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData, TTransformValues>>,
  itemId: string,
  offsetMs: number,
  patch: TimelineEditorTransformPointPatch<TTransformValues>,
  options: TimelineEditorOperationOptions = {},
) {
  return updateTimelineEditorItemTransform(tracks, itemId, options, (transform, durationMs) => {
    const targetOffsetMs = normalizeTimelineEditorTransform(
      { points: [{ offsetMs, values: {} }] },
      durationMs,
    ).points[0]?.offsetMs;

    if (targetOffsetMs === undefined) {
      return transform;
    }

    let changed = false;
    const points = transform.points.map((point) => {
      if (point.offsetMs !== targetOffsetMs) {
        return point;
      }

      changed = true;
      return {
        ...point,
        ...patch,
        offsetMs: point.offsetMs,
        values: patch.values ? { ...point.values, ...patch.values } : point.values,
      };
    });

    return changed
      ? normalizeTimelineEditorTransform({ ...transform, points }, durationMs)
      : transform;
  });
}

export function moveTimelineEditorTransformPoint<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TTransformValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData, TTransformValues>>,
  itemId: string,
  fromOffsetMs: number,
  toOffsetMs: number,
  options: TimelineEditorOperationOptions = {},
) {
  return updateTimelineEditorItemTransform(tracks, itemId, options, (transform, durationMs) => {
    const from = normalizeTimelineEditorTransform(
      { points: [{ offsetMs: fromOffsetMs, values: {} }] },
      durationMs,
    ).points[0]?.offsetMs;
    const to = normalizeTimelineEditorTransform(
      { points: [{ offsetMs: toOffsetMs, values: {} }] },
      durationMs,
    ).points[0]?.offsetMs;

    if (from === undefined || to === undefined || from === to) {
      return transform;
    }

    const movedPoint = transform.points.find((point) => point.offsetMs === from);

    if (!movedPoint) {
      return transform;
    }

    const replacedPoint = transform.points.find((point) => point.offsetMs === to);
    const points = transform.points
      .filter((point) => point.offsetMs !== from && point.offsetMs !== to)
      .concat({
        ...replacedPoint,
        ...movedPoint,
        offsetMs: to,
        values: {
          ...(replacedPoint?.values ?? {}),
          ...movedPoint.values,
        },
      });

    return normalizeTimelineEditorTransform({ ...transform, points }, durationMs);
  });
}

export function removeTimelineEditorTransformPoint<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TTransformValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData, TTransformValues>>,
  itemId: string,
  offsetMs: number,
  options: TimelineEditorOperationOptions = {},
) {
  return updateTimelineEditorItemTransform(tracks, itemId, options, (transform, durationMs) => {
    const targetOffsetMs = normalizeTimelineEditorTransform(
      { points: [{ offsetMs, values: {} }] },
      durationMs,
    ).points[0]?.offsetMs;

    if (targetOffsetMs === undefined) {
      return transform;
    }

    const points = transform.points.filter((point) => point.offsetMs !== targetOffsetMs);

    if (points.length === transform.points.length) {
      return transform;
    }

    if (points.length === 0) {
      return transform.data ? { ...transform, points: [] } : undefined;
    }

    return normalizeTimelineEditorTransform({ ...transform, points }, durationMs);
  });
}

function updateTimelineEditorItemTransform<
  TTrackData,
  TItemData,
  TTransformValues extends TimelineEditorTransformValues,
>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData, TTransformValues>>,
  itemId: string,
  options: TimelineEditorOperationOptions,
  update: (
    transform: TimelineEditorTransform<TTransformValues>,
    durationMs: number,
  ) => TimelineEditorTransform<TTransformValues> | undefined,
) {
  const found = findTimelineEditorItem(tracks, itemId);

  if (!found || found.item.locked || found.track.locked) {
    return tracks;
  }

  const currentTransform = found.item.transform ?? { points: [] };
  const nextTransform = update(currentTransform, found.item.durationMs);

  if (nextTransform === currentTransform) {
    return tracks;
  }

  return setTimelineEditorItemTransform(tracks, itemId, nextTransform, options);
}
