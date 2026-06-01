import {
  createTimelineAudioExtension as createBaseTimelineAudioExtension,
  createTimelineAudioFileAsset as createBaseTimelineAudioFileAsset,
  createTimelineAudioWaveformFromAudioBuffer,
  loadTimelineAudioMetadata,
  type TimelineAudioExtensionOptions as BaseTimelineAudioExtensionOptions,
  type TimelineAudioFileAssetOptions as BaseTimelineAudioFileAssetOptions,
  type TimelineAudioFileAssetResult as BaseTimelineAudioFileAssetResult,
  type TimelineAudioItemData,
  type TimelineAudioMetadata,
  type TimelineAudioPreviewSourceResolver,
  type TimelineAudioWaveform,
  type TimelineAudioWaveformOptions,
} from "@moritzbrantner/timeline-editor/audio";
import type { TimelineEditorExtension } from "@moritzbrantner/timeline-editor";
import {
  createTimelineBrowserWasmBackend,
  type TimelineComputeBackend,
  type TimelineComputeProgress,
  type TimelineComputeRunOptions,
  type TimelineComputeSource,
} from "@timeline-editor/compute";

export {
  createTimelineAudioWaveformFromAudioBuffer,
  loadTimelineAudioMetadata,
  type TimelineAudioItemData,
  type TimelineAudioMetadata,
  type TimelineAudioPreviewSourceResolver,
  type TimelineAudioWaveform,
  type TimelineAudioWaveformOptions,
};

export type TimelineAudioAnalyzeOptions = TimelineAudioWaveformOptions & {
  backend?: TimelineComputeBackend;
  signal?: AbortSignal;
  onProgress?: (progress: TimelineComputeProgress) => void;
};

export type TimelineAudioAnalyzeResult = TimelineAudioMetadata & {
  warnings?: string[];
};

export type TimelineAudioExtensionOptions = BaseTimelineAudioExtensionOptions & {
  backend?: TimelineComputeBackend;
};

export type TimelineAudioFileAssetOptions = BaseTimelineAudioFileAssetOptions & {
  backend?: TimelineComputeBackend;
  signal?: AbortSignal;
  onProgress?: (progress: TimelineComputeProgress) => void;
};

export type TimelineAudioFileAssetResult = BaseTimelineAudioFileAssetResult & {
  warnings?: string[];
};

export function createTimelineAudioExtension(
  options: TimelineAudioExtensionOptions = {},
): TimelineEditorExtension<TimelineAudioItemData> {
  return createBaseTimelineAudioExtension(options);
}

export async function createTimelineAudioFileAsset(
  file: File,
  options: TimelineAudioFileAssetOptions = {},
): Promise<TimelineAudioFileAssetResult> {
  const metadata = await analyzeTimelineAudioSource(
    await createTimelineAudioFileSource(file),
    options,
  ).catch((): TimelineAudioAnalyzeResult => ({}));

  const hasAcceleratedMetadata =
    metadata.durationMs !== undefined ||
    metadata.channels !== undefined ||
    metadata.sampleRate !== undefined ||
    metadata.waveform !== undefined;

  const result = await createBaseTimelineAudioFileAsset(file, {
    ...options,
    durationMs: options.durationMs ?? metadata.durationMs,
    waveform: options.waveform ?? metadata.waveform,
    generateWaveform: hasAcceleratedMetadata ? false : options.generateWaveform,
  });

  if (metadata.channels !== undefined || metadata.sampleRate !== undefined) {
    result.asset.data = {
      mediaType: "audio",
      ...result.asset.data,
      channels: result.asset.data?.channels ?? metadata.channels,
      sampleRate: result.asset.data?.sampleRate ?? metadata.sampleRate,
    };
  }

  return { ...result, warnings: metadata.warnings };
}

export async function analyzeTimelineAudioSource(
  source: TimelineComputeSource,
  options: TimelineAudioAnalyzeOptions = {},
): Promise<TimelineAudioAnalyzeResult> {
  const task = {
    domain: "audio",
    operation: "analyze",
    source,
    options: {
      sampleCount: options.sampleCount,
      normalize: options.normalize,
    },
  } as const;

  if (!options.backend?.supports(task)) {
    return {
      warnings: ["No audio compute backend is available; using browser fallback metadata."],
    };
  }

  return options.backend.run<TimelineAudioAnalyzeResult>(task, getRunOptions(options));
}

export function createTimelineAudioBrowserBackend(options: { workerUrl?: URL | string } = {}) {
  return createTimelineBrowserWasmBackend({
    worker: () =>
      new Worker(options.workerUrl ?? new URL("./worker.js", import.meta.url), {
        type: "module",
      }),
  });
}

async function createTimelineAudioFileSource(file: File): Promise<TimelineComputeSource> {
  return {
    type: "bytes",
    bytes: await file.arrayBuffer(),
    label: file.name,
    mimeType: file.type || undefined,
  };
}

function getRunOptions(options: TimelineAudioAnalyzeOptions): TimelineComputeRunOptions {
  return {
    signal: options.signal,
    onProgress: options.onProgress,
  };
}
