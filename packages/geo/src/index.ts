import { createElement } from "react";

import type {
  TimelineEditorExtension,
  TimelineMediaSourceRef,
  TimelineWorkbenchAsset,
} from "@moritzbrantner/timeline-editor";
import {
  createTimelineBrowserWasmBackend,
  type TimelineComputeBackend,
  type TimelineComputeSource,
} from "@timeline-editor/compute";

export type TimelineGeoItemData = {
  domain: "geo";
  mediaType?: "numeric-data";
  source?: TimelineMediaSourceRef;
  geojson?: unknown;
  layerId?: string;
  layerType?: "geojson" | "marker" | "route" | "raster" | "vector";
  bbox?: [number, number, number, number];
  center?: [number, number];
  camera?: {
    center?: [number, number];
    zoom?: number;
    bearing?: number;
    pitch?: number;
  };
  style?: Record<string, unknown>;
  opacity?: number;
};

export type TimelineGeoAnalyzeResult = {
  bbox?: [number, number, number, number];
  center?: [number, number];
  featureCount?: number;
  warnings?: string[];
};

export type TimelineGeoJsonAssetOptions = {
  id?: string;
  label?: string;
  durationMs?: number;
  color?: string;
  layerId?: string;
  layerType?: TimelineGeoItemData["layerType"];
  metadata?: Record<string, unknown>;
  backend?: TimelineComputeBackend;
  signal?: AbortSignal;
};

export type TimelineGeoJsonAssetResult = {
  asset: TimelineWorkbenchAsset<TimelineGeoItemData>;
  warnings?: string[];
  metadata?: TimelineGeoAnalyzeResult;
};

export function createTimelineGeoExtension(
  _options: { backend?: TimelineComputeBackend } = {},
): TimelineEditorExtension<TimelineGeoItemData> {
  return {
    id: "timeline-geo",
    itemKinds: ["geo", "geojson", "map-layer", "map-camera"],
    domains: ["geo", "map"],
    renderItem: ({ item }) =>
      createElement(
        "span",
        { className: "grid min-w-0 gap-0.5" },
        createElement("span", { className: "truncate" }, item.label),
        item.data?.bbox
          ? createElement(
              "span",
              { className: "truncate text-[10px] text-white/70" },
              formatTimelineGeoBbox(item.data.bbox),
            )
          : null,
      ),
  };
}

export async function createTimelineGeoJsonAsset(
  file: File,
  options: TimelineGeoJsonAssetOptions = {},
): Promise<TimelineGeoJsonAssetResult> {
  const label = options.label ?? file.name;
  const text = await file.text();
  const geojson = JSON.parse(text) as unknown;
  const analysis = await analyzeTimelineGeoJson(geojson, {
    backend: options.backend,
    signal: options.signal,
  });

  return {
    asset: {
      id: options.id ?? createTimelineGeoJsonAssetId(label),
      label,
      kind: "geojson",
      mediaType: "numeric-data",
      durationMs: Math.max(1, options.durationMs ?? 1_000),
      color: options.color,
      description: file.type || "GeoJSON",
      data: {
        domain: "geo",
        mediaType: "numeric-data",
        source: {
          label,
          mimeType: file.type || undefined,
          metadata: {
            fileName: file.name,
            lastModified: file.lastModified,
            size: file.size,
            featureCount: analysis.featureCount,
            ...options.metadata,
          },
        },
        geojson,
        layerId: options.layerId,
        layerType: options.layerType ?? "geojson",
        bbox: analysis.bbox,
        center: analysis.center,
      },
    },
    warnings: analysis.warnings,
    metadata: analysis,
  };
}

export async function analyzeTimelineGeoJson(
  geojson: unknown,
  options: { backend?: TimelineComputeBackend; signal?: AbortSignal } = {},
): Promise<TimelineGeoAnalyzeResult> {
  const task = {
    domain: "geo",
    operation: "analyze",
    geojson,
  } as const;

  if (options.backend?.supports(task)) {
    return options.backend.run<TimelineGeoAnalyzeResult>(task, { signal: options.signal });
  }

  return analyzeTimelineGeoJsonSync(geojson);
}

export function analyzeTimelineGeoJsonSync(geojson: unknown): TimelineGeoAnalyzeResult {
  const coordinates: Array<[number, number]> = [];
  collectGeoCoordinates(geojson, coordinates);

  if (coordinates.length === 0) {
    return {
      warnings: ["GeoJSON contains no valid coordinate pairs."],
    };
  }

  const xs = coordinates.map(([x]) => x);
  const ys = coordinates.map(([, y]) => y);
  const bbox: [number, number, number, number] = [
    Math.min(...xs),
    Math.min(...ys),
    Math.max(...xs),
    Math.max(...ys),
  ];

  return {
    bbox,
    center: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
    featureCount: countGeoFeatures(geojson),
  };
}

export function createTimelineGeoBrowserBackend(options: { workerUrl?: URL | string } = {}) {
  return createTimelineBrowserWasmBackend({
    worker: () =>
      new Worker(options.workerUrl ?? new URL("./worker.js", import.meta.url), {
        type: "module",
      }),
  });
}

export async function createTimelineGeoJsonSource(file: File): Promise<TimelineComputeSource> {
  return {
    type: "bytes",
    bytes: await file.arrayBuffer(),
    label: file.name,
    mimeType: file.type || undefined,
  };
}

function collectGeoCoordinates(input: unknown, coordinates: Array<[number, number]>) {
  if (Array.isArray(input)) {
    if (
      input.length >= 2 &&
      typeof input[0] === "number" &&
      typeof input[1] === "number" &&
      Number.isFinite(input[0]) &&
      Number.isFinite(input[1])
    ) {
      coordinates.push([input[0], input[1]]);
      return;
    }

    for (const value of input) {
      collectGeoCoordinates(value, coordinates);
    }

    return;
  }

  if (input && typeof input === "object") {
    const maybeCoordinates = input as {
      coordinates?: unknown;
      geometry?: unknown;
      features?: unknown;
    };
    collectGeoCoordinates(maybeCoordinates.coordinates, coordinates);
    collectGeoCoordinates(maybeCoordinates.geometry, coordinates);
    collectGeoCoordinates(maybeCoordinates.features, coordinates);
  }
}

function countGeoFeatures(input: unknown): number {
  if (!input || typeof input !== "object") {
    return 0;
  }

  const value = input as { type?: unknown; features?: unknown };

  if (value.type === "FeatureCollection" && Array.isArray(value.features)) {
    return value.features.length;
  }

  if (value.type === "Feature") {
    return 1;
  }

  return 0;
}

function formatTimelineGeoBbox(bbox: [number, number, number, number]) {
  return bbox.map((value) => Math.round(value * 10_000) / 10_000).join(", ");
}

function createTimelineGeoJsonAssetId(label: string) {
  const slug = label
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");

  return slug ? `geo-${slug}` : "geojson-file";
}
