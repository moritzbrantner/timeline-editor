import { clampTimelineEditorTime } from "./time";
import {
  type TimelineEditorTransformEasing,
  type TimelineEditorItem,
  type TimelineEditorTransform,
  type TimelineEditorTransformPoint,
  type TimelineEditorTransformValues,
} from "./types";

const normalizedTransformCache = new WeakMap<
  TimelineEditorTransform<TimelineEditorTransformValues>,
  Map<number, TimelineEditorTransform<TimelineEditorTransformValues>>
>();

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

  const points = getCachedNormalizedTimelineEditorTransform(transform, durationMs).points;
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

function getCachedNormalizedTimelineEditorTransform<
  TValues extends TimelineEditorTransformValues = TimelineEditorTransformValues,
>(
  transform: TimelineEditorTransform<TValues>,
  durationMs: number,
): TimelineEditorTransform<TValues> {
  const cacheKey = Number.isFinite(durationMs) ? durationMs : Number.POSITIVE_INFINITY;
  const typedTransform = transform as TimelineEditorTransform<TimelineEditorTransformValues>;
  let cachedByDuration = normalizedTransformCache.get(typedTransform);

  if (!cachedByDuration) {
    cachedByDuration = new Map();
    normalizedTransformCache.set(typedTransform, cachedByDuration);
  }

  const cached = cachedByDuration.get(cacheKey);

  if (cached) {
    return cached as TimelineEditorTransform<TValues>;
  }

  const normalized = normalizeTimelineEditorTransform(transform, durationMs);
  cachedByDuration.set(
    cacheKey,
    normalized as TimelineEditorTransform<TimelineEditorTransformValues>,
  );

  return normalized;
}

export function applyTimelineEditorTransformEasing(
  easing: TimelineEditorTransformEasing | undefined,
  ratio: number,
): number {
  const safeRatio = Math.max(0, Math.min(1, ratio));

  switch (easing) {
    case "hold":
      return 0;
    case "ease-in":
    case "cubic-in":
      return easeInPower(safeRatio, 3);
    case "ease-out":
    case "cubic-out":
      return easeOutPower(safeRatio, 3);
    case "ease-in-out":
    case "cubic":
    case "cubic-in-out":
      return easeInOutPower(safeRatio, 3);
    case "quadratic":
    case "quadratic-in-out":
      return easeInOutPower(safeRatio, 2);
    case "quadratic-in":
      return easeInPower(safeRatio, 2);
    case "quadratic-out":
      return easeOutPower(safeRatio, 2);
    case "quartic":
    case "quartic-in-out":
      return easeInOutPower(safeRatio, 4);
    case "quartic-in":
      return easeInPower(safeRatio, 4);
    case "quartic-out":
      return easeOutPower(safeRatio, 4);
    case "linear":
    case undefined:
      return safeRatio;
  }
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
  const easedRatio = applyTimelineEditorTransformEasing(previousPoint.easing, ratio);
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

    values[key] = (previousValue + (nextValue - previousValue) * easedRatio) as TValues[typeof key];
  }

  return values;
}

function easeInPower(ratio: number, power: number) {
  return ratio ** power;
}

function easeOutPower(ratio: number, power: number) {
  return 1 - (1 - ratio) ** power;
}

function easeInOutPower(ratio: number, power: number) {
  if (ratio < 0.5) {
    return 2 ** (power - 1) * ratio ** power;
  }

  return 1 - (-2 * ratio + 2) ** power / 2;
}
