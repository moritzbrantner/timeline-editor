import { clampTimelineEditorTime } from "./time";
import {
  type TimelineEditorItem,
  type TimelineEditorTransform,
  type TimelineEditorTransformPoint,
  type TimelineEditorTransformValues,
} from "./types";

export function normalizeTimelineEditorTransform<
  TValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
>(
  transform: TimelineEditorTransform<TValues>,
  durationMs: number,
): TimelineEditorTransform<TValues> {
  const normalizedPoints = transform.points
    .map((point) => normalizeTimelineEditorTransformPoint(point, durationMs))
    .sort((left, right) => left.offsetMs - right.offsetMs);

  return {
    ...transform,
    points: normalizedPoints,
  };
}

export function getTimelineEditorTransformValuesAt<
  TValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
>(
  transform: TimelineEditorTransform<TValues> | undefined,
  offsetMs: number,
  durationMs = Number.POSITIVE_INFINITY,
): Partial<TValues> {
  if (!transform || transform.points.length === 0) {
    return {};
  }

  const points = normalizeTimelineEditorTransform(transform, durationMs).points;
  const safeOffsetMs = clampTimelineEditorTime(offsetMs, 0, durationMs);
  const firstPoint = points[0]!;
  const lastPoint = points[points.length - 1]!;

  if (safeOffsetMs <= firstPoint.offsetMs) {
    return { ...firstPoint.values };
  }

  if (safeOffsetMs >= lastPoint.offsetMs) {
    return { ...lastPoint.values };
  }

  for (let index = 1; index < points.length; index += 1) {
    const nextPoint = points[index]!;

    if (nextPoint.offsetMs < safeOffsetMs) {
      continue;
    }

    const previousPoint = points[index - 1]!;

    if (previousPoint.offsetMs === nextPoint.offsetMs || previousPoint.easing === "hold") {
      return { ...previousPoint.values };
    }

    return interpolateTimelineEditorTransformValues(previousPoint, nextPoint, safeOffsetMs);
  }

  return { ...lastPoint.values };
}

export function getTimelineEditorItemTransformValuesAt<
  TData = Record<string, unknown>,
  TValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
>(item: TimelineEditorItem<TData, TValues>, timeMs: number): Partial<TValues> {
  return getTimelineEditorTransformValuesAt(item.transform, timeMs - item.startMs, item.durationMs);
}

export function sliceTimelineEditorTransform<
  TValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
>(
  transform: TimelineEditorTransform<TValues> | undefined,
  startOffsetMs: number,
  endOffsetMs: number,
): TimelineEditorTransform<TValues> | undefined {
  if (!transform) {
    return undefined;
  }

  const segmentStartMs = Math.max(0, Math.min(startOffsetMs, endOffsetMs));
  const segmentEndMs = Math.max(segmentStartMs, endOffsetMs);
  const segmentDurationMs = segmentEndMs - segmentStartMs;
  const transformDurationMs = Math.max(
    segmentEndMs,
    ...transform.points.map((point) => point.offsetMs),
  );
  const points: Array<TimelineEditorTransformPoint<TValues>> = [
    {
      offsetMs: 0,
      values: getTimelineEditorTransformValuesAt(transform, segmentStartMs, transformDurationMs),
    },
    ...transform.points
      .filter((point) => point.offsetMs > segmentStartMs && point.offsetMs < segmentEndMs)
      .map((point) => {
        const nextPoint: TimelineEditorTransformPoint<TValues> = {
          offsetMs: point.offsetMs - segmentStartMs,
          values: { ...point.values },
        };

        if (point.easing) {
          nextPoint.easing = point.easing;
        }

        return nextPoint;
      }),
  ];

  if (segmentDurationMs > 0) {
    points.push({
      offsetMs: segmentDurationMs,
      values: getTimelineEditorTransformValuesAt(transform, segmentEndMs, transformDurationMs),
    });
  }

  return normalizeTimelineEditorTransform(
    {
      ...transform,
      points,
    },
    segmentDurationMs,
  );
}

function normalizeTimelineEditorTransformPoint<
  TValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
>(
  point: TimelineEditorTransformPoint<TValues>,
  durationMs: number,
): TimelineEditorTransformPoint<TValues> {
  return {
    ...point,
    offsetMs: clampTimelineEditorTime(point.offsetMs, 0, durationMs),
    values: { ...point.values },
  };
}

function interpolateTimelineEditorTransformValues<
  TValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
>(
  previousPoint: TimelineEditorTransformPoint<TValues>,
  nextPoint: TimelineEditorTransformPoint<TValues>,
  offsetMs: number,
): Partial<TValues> {
  const ratio = (offsetMs - previousPoint.offsetMs) / (nextPoint.offsetMs - previousPoint.offsetMs);
  const keys = new Set([
    ...Object.keys(previousPoint.values),
    ...Object.keys(nextPoint.values),
  ] as Array<keyof TValues & string>);
  const values: Partial<TValues> = {};

  for (const key of keys) {
    const previousValue = previousPoint.values[key];
    const nextValue = nextPoint.values[key];

    if (previousValue === undefined) {
      values[key] = nextValue as TValues[typeof key];
      continue;
    }

    if (nextValue === undefined) {
      values[key] = previousValue as TValues[typeof key];
      continue;
    }

    values[key] = (previousValue + (nextValue - previousValue) * ratio) as TValues[typeof key];
  }

  return values;
}
