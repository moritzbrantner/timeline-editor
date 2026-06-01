import {
  createTimelineNumericDataExtension,
  type TimelineNumericDataItemData,
  type TimelineNumericDataPoint,
  type TimelineNumericDataSeries,
} from "@moritzbrantner/timeline-editor/data";
import {
  createTimelineBrowserWasmBackend,
  type TimelineComputeBackend,
} from "@timeline-editor/compute";

export {
  createTimelineNumericDataExtension,
  type TimelineNumericDataItemData,
  type TimelineNumericDataPoint,
  type TimelineNumericDataSeries,
};

export type TimelineDataAnalyzeResult = {
  min?: number;
  max?: number;
  series: TimelineNumericDataSeries[];
  warnings?: string[];
};

export async function analyzeTimelineNumericData(
  data: TimelineNumericDataItemData,
  options: {
    backend?: TimelineComputeBackend;
    signal?: AbortSignal;
    maxPoints?: number;
    startMs?: number;
    endMs?: number;
  } = {},
): Promise<TimelineDataAnalyzeResult> {
  const task = {
    domain: "data",
    operation: options.maxPoints ? "downsample" : "analyze",
    series: data.series,
    options: {
      maxPoints: options.maxPoints,
      startMs: options.startMs,
      endMs: options.endMs,
    },
  } as const;

  if (options.backend?.supports(task)) {
    return options.backend.run<TimelineDataAnalyzeResult>(task, { signal: options.signal });
  }

  return analyzeTimelineNumericDataSync(data, options);
}

export function analyzeTimelineNumericDataSync(
  data: TimelineNumericDataItemData,
  options: { maxPoints?: number; startMs?: number; endMs?: number } = {},
): TimelineDataAnalyzeResult {
  const series = data.series.map((entry) => ({
    ...entry,
    points: downsampleTimelineDataPoints(
      filterTimelineDataPoints(entry.points, options),
      options.maxPoints,
    ),
  }));
  const values = series.flatMap((entry) => entry.points.map((point) => point.value));

  return {
    min: values.length > 0 ? Math.min(...values) : undefined,
    max: values.length > 0 ? Math.max(...values) : undefined,
    series,
  };
}

export function createTimelineDataBrowserBackend(options: { workerUrl?: URL | string } = {}) {
  return createTimelineBrowserWasmBackend({
    worker: () =>
      new Worker(options.workerUrl ?? new URL("./worker.js", import.meta.url), {
        type: "module",
      }),
  });
}

function filterTimelineDataPoints(
  points: TimelineNumericDataPoint[],
  options: { startMs?: number; endMs?: number },
) {
  return points.filter(
    (point) =>
      (options.startMs === undefined || point.timeMs >= options.startMs) &&
      (options.endMs === undefined || point.timeMs <= options.endMs),
  );
}

function downsampleTimelineDataPoints(
  points: TimelineNumericDataPoint[],
  maxPoints = points.length,
) {
  const limit = Math.max(0, Math.floor(maxPoints));

  if (limit === 0 || points.length <= limit) {
    return points;
  }

  const step = points.length / limit;

  return Array.from({ length: limit }, (_, index) => points[Math.floor(index * step)]!).filter(
    Boolean,
  );
}
