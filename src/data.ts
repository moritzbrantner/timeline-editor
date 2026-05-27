import { createElement } from "react";

import type { TimelineEditorExtension } from "./react/workbench/types";
import type { TimelineMediaSourceRef } from "./media-types";

export type TimelineNumericDataPoint = {
  timeMs: number;
  value: number;
};

export type TimelineNumericDataSeries = {
  id?: string;
  label?: string;
  unit?: string;
  color?: string;
  points: TimelineNumericDataPoint[];
};

export type TimelineNumericDataItemData = {
  mediaType: "numeric-data";
  source?: TimelineMediaSourceRef;
  series: TimelineNumericDataSeries[];
  min?: number;
  max?: number;
  data?: Record<string, unknown>;
};

export type { TimelineMediaSourceRef } from "./media-types";

export function createTimelineNumericDataExtension(): TimelineEditorExtension<TimelineNumericDataItemData> {
  return {
    id: "timeline-numeric-data",
    itemKinds: ["data", "numeric-data"],
    renderItem: ({ item }) =>
      createElement(
        "span",
        { className: "grid min-w-0 gap-0.5" },
        createElement("span", { className: "truncate" }, item.label),
        createTimelineNumericDataSparkline(item.data),
        getTimelineNumericDataLabel(item.data)
          ? createElement(
              "span",
              { className: "truncate text-[10px] text-white/70" },
              getTimelineNumericDataLabel(item.data),
            )
          : null,
      ),
  };
}

function createTimelineNumericDataSparkline(data: TimelineNumericDataItemData | undefined) {
  if (!data?.series.length) {
    return null;
  }

  const values = data.series.flatMap((series) => series.points.map((point) => point.value));
  if (values.length === 0) {
    return null;
  }

  const min = data.min ?? Math.min(...values);
  const max = data.max ?? Math.max(...values);
  const span = max === min ? 1 : max - min;

  return createElement(
    "svg",
    {
      "aria-hidden": true,
      "data-slot": "timeline-media-numeric-sparkline",
      className: "h-4 w-full overflow-visible",
      preserveAspectRatio: "none",
      viewBox: "0 0 100 24",
    },
    data.series.slice(0, 4).map((series, index) =>
      createElement("polyline", {
        key: series.id ?? index,
        fill: "none",
        points: getTimelineNumericDataPolylinePoints(series.points, min, span),
        stroke: series.color ?? "rgba(255,255,255,0.75)",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 2,
      }),
    ),
  );
}

function getTimelineNumericDataPolylinePoints(
  points: TimelineNumericDataPoint[],
  min: number,
  span: number,
) {
  if (points.length === 0) {
    return "";
  }

  const startMs = Math.min(...points.map((point) => point.timeMs));
  const endMs = Math.max(...points.map((point) => point.timeMs));
  const durationMs = endMs === startMs ? 1 : endMs - startMs;

  return points
    .map((point) => {
      const x = ((point.timeMs - startMs) / durationMs) * 100;
      const y = 24 - ((point.value - min) / span) * 24;

      return `${roundSvgNumber(x)},${roundSvgNumber(y)}`;
    })
    .join(" ");
}

function getTimelineNumericDataLabel(data: TimelineNumericDataItemData | undefined) {
  const firstSeries = data?.series[0];

  if (!firstSeries) {
    return undefined;
  }

  return [firstSeries.label, firstSeries.unit].filter(Boolean).join(" · ");
}

function roundSvgNumber(value: number) {
  return Math.round(value * 100) / 100;
}
