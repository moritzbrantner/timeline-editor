import {
  createTimelineVideoExtension as createBaseTimelineVideoExtension,
  createTimelineVideoFileAsset as createBaseTimelineVideoFileAsset,
  type TimelineVideoFileAssetOptions as BaseTimelineVideoFileAssetOptions,
  type TimelineVideoFileAssetResult as BaseTimelineVideoFileAssetResult,
  type TimelineVideoItemData,
} from "@moritzbrantner/timeline-editor/video";
import type { TimelineEditorExtension } from "@moritzbrantner/timeline-editor";
import {
  createTimelineBrowserWasmBackend,
  type TimelineComputeBackend,
  type TimelineComputeProgress,
  type TimelineComputeRunOptions,
  type TimelineComputeSource,
} from "@timeline-editor/compute";

export type { TimelineVideoItemData };

export type TimelineVideoMetadata = {
  durationMs?: number;
  width?: number;
  height?: number;
  frameRate?: number;
  poster?: string;
  thumbnails?: string[];
  warnings?: string[];
};

export type TimelineVideoAnalyzeOptions = {
  backend?: TimelineComputeBackend;
  signal?: AbortSignal;
  onProgress?: (progress: TimelineComputeProgress) => void;
  generatePoster?: boolean;
  generateThumbnails?: boolean;
  posterTimeMs?: number;
  thumbnailCount?: number;
  thumbnailTimesMs?: number[];
  thumbnailMimeType?: string;
  thumbnailQuality?: number;
};

export type TimelineVideoExtensionOptions = {
  backend?: TimelineComputeBackend;
};

export type TimelineVideoFileAssetOptions = BaseTimelineVideoFileAssetOptions & {
  backend?: TimelineComputeBackend;
  signal?: AbortSignal;
  onProgress?: (progress: TimelineComputeProgress) => void;
};

export type TimelineVideoFileAssetResult = BaseTimelineVideoFileAssetResult & {
  warnings?: string[];
};

export function createTimelineVideoExtension(
  _options: TimelineVideoExtensionOptions = {},
): TimelineEditorExtension<TimelineVideoItemData> {
  return createBaseTimelineVideoExtension();
}

export async function createTimelineVideoFileAsset(
  file: File,
  options: TimelineVideoFileAssetOptions = {},
): Promise<TimelineVideoFileAssetResult> {
  const metadata = await analyzeTimelineVideoSource(await createTimelineVideoFileSource(file), {
    ...options,
    generatePoster: options.generatePoster,
    generateThumbnails:
      options.thumbnails === undefined &&
      ((options.thumbnailCount ?? 0) > 0 || (options.thumbnailTimesMs?.length ?? 0) > 0),
  }).catch((): TimelineVideoMetadata => ({}));

  const hasAcceleratedMetadata =
    metadata.durationMs !== undefined ||
    metadata.width !== undefined ||
    metadata.height !== undefined ||
    metadata.poster !== undefined ||
    metadata.thumbnails !== undefined;

  const result = await createBaseTimelineVideoFileAsset(file, {
    ...options,
    durationMs: options.durationMs ?? metadata.durationMs,
    width: options.width ?? metadata.width,
    height: options.height ?? metadata.height,
    poster: options.poster ?? metadata.poster,
    thumbnails: options.thumbnails ?? metadata.thumbnails,
    generatePoster: hasAcceleratedMetadata ? false : options.generatePoster,
  });

  if (metadata.frameRate !== undefined) {
    result.asset.data = {
      mediaType: "video",
      ...result.asset.data,
      data: {
        ...result.asset.data?.data,
        frameRate: metadata.frameRate,
      },
    };
  }

  return { ...result, warnings: metadata.warnings };
}

export async function analyzeTimelineVideoSource(
  source: TimelineComputeSource,
  options: TimelineVideoAnalyzeOptions = {},
): Promise<TimelineVideoMetadata> {
  const task = {
    domain: "video",
    operation: "analyze",
    source,
    options: {
      generatePoster: options.generatePoster,
      generateThumbnails: options.generateThumbnails,
      posterTimeMs: options.posterTimeMs,
      thumbnailCount: options.thumbnailCount,
      thumbnailTimesMs: options.thumbnailTimesMs,
      thumbnailMimeType: options.thumbnailMimeType,
      thumbnailQuality: options.thumbnailQuality,
    },
  } as const;

  if (!options.backend?.supports(task)) {
    return {
      warnings: ["No video compute backend is available; using browser media fallback metadata."],
    };
  }

  return options.backend.run<TimelineVideoMetadata>(task, getRunOptions(options));
}

export function createTimelineVideoBrowserBackend(options: { workerUrl?: URL | string } = {}) {
  return createTimelineBrowserWasmBackend({
    worker: () =>
      new Worker(options.workerUrl ?? new URL("./worker.js", import.meta.url), {
        type: "module",
      }),
  });
}

async function createTimelineVideoFileSource(file: File): Promise<TimelineComputeSource> {
  return {
    type: "bytes",
    bytes: await file.arrayBuffer(),
    label: file.name,
    mimeType: file.type || undefined,
  };
}

function getRunOptions(options: TimelineVideoAnalyzeOptions): TimelineComputeRunOptions {
  return {
    signal: options.signal,
    onProgress: options.onProgress,
  };
}
