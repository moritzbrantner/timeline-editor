import {
  createTimelineTextExtension,
  detectTimelineTextFormat,
  getTimelineTextCueAt,
  getTimelineTextCuesAt,
  getTimelineTextDisplayText,
  getTimelineTextStyleForCue,
  parseTimelineAssText,
  parseTimelineSrtText,
  parseTimelineText,
  parseTimelineWebVttText,
  type TimelineTextAlignment,
  type TimelineTextCue,
  type TimelineTextFileAssetOptions,
  type TimelineTextFormat,
  type TimelineTextItemData,
  type TimelineTextParseOptions,
  type TimelineTextParseResult,
  type TimelineTextStyle,
} from "@moritzbrantner/timeline-editor/text";
import type {
  TimelineEditorExtension,
  TimelineWorkbenchAsset,
} from "@moritzbrantner/timeline-editor";
import {
  createTimelineBrowserWasmBackend,
  type TimelineComputeBackend,
  type TimelineComputeSource,
} from "@timeline-editor/compute";

export {
  createTimelineTextExtension,
  createTimelineTextExtension as createTimelineCaptionsExtension,
  detectTimelineTextFormat,
  detectTimelineTextFormat as detectTimelineCaptionFormat,
  getTimelineTextCueAt,
  getTimelineTextCueAt as getTimelineCaptionCueAt,
  getTimelineTextCuesAt,
  getTimelineTextCuesAt as getTimelineCaptionCuesAt,
  getTimelineTextDisplayText,
  getTimelineTextDisplayText as getTimelineCaptionDisplayText,
  getTimelineTextStyleForCue,
  getTimelineTextStyleForCue as getTimelineCaptionStyleForCue,
  parseTimelineAssText,
  parseTimelineAssText as parseTimelineAssCaptions,
  parseTimelineSrtText,
  parseTimelineSrtText as parseTimelineSrtCaptions,
  parseTimelineText,
  parseTimelineText as parseTimelineCaptionsSync,
  parseTimelineWebVttText,
  parseTimelineWebVttText as parseTimelineWebVttCaptions,
  type TimelineTextAlignment as TimelineCaptionAlignment,
  type TimelineTextCue as TimelineCaptionCue,
  type TimelineTextFormat as TimelineCaptionFormat,
  type TimelineTextItemData as TimelineCaptionItemData,
  type TimelineTextParseOptions as TimelineCaptionParseOptions,
  type TimelineTextParseResult as TimelineCaptionParseResult,
  type TimelineTextStyle as TimelineCaptionStyle,
};

export type {
  TimelineTextAlignment,
  TimelineTextCue,
  TimelineTextFormat,
  TimelineTextItemData,
  TimelineTextParseOptions,
  TimelineTextParseResult,
  TimelineTextStyle,
};

export type TimelineCaptionsExtensionOptions = {
  backend?: TimelineComputeBackend;
};

export type TimelineCaptionFileAssetOptions = TimelineTextFileAssetOptions & {
  backend?: TimelineComputeBackend;
  signal?: AbortSignal;
};

export type TimelineCaptionFileAssetResult = {
  asset: TimelineWorkbenchAsset<TimelineTextItemData>;
  warnings?: string[];
};

export function createTimelineCaptionExtension(
  _options: TimelineCaptionsExtensionOptions = {},
): TimelineEditorExtension<TimelineTextItemData> {
  return createTimelineTextExtension();
}

export async function createTimelineCaptionFileAsset(
  file: File,
  options: TimelineCaptionFileAssetOptions = {},
): Promise<TimelineCaptionFileAssetResult> {
  const label = options.label ?? file.name;
  const text = await file.text();
  const parsed = await parseTimelineCaptions(text, {
    backend: options.backend,
    format: undefined,
    sourceLabel: label,
    mimeType: file.type || undefined,
    signal: options.signal,
  });
  const durationMs =
    options.durationMs ?? parsed.cues.reduce((duration, cue) => Math.max(duration, cue.endMs), 0);

  return {
    asset: {
      id: options.id ?? createTimelineCaptionFileAssetId(label),
      label,
      kind: "subtitle",
      mediaType: "text",
      durationMs: Math.max(1, durationMs || 1_000),
      color: options.color,
      description: file.type || `${parsed.format.toUpperCase()} subtitles`,
      data: {
        mediaType: "text",
        format: parsed.format,
        language: options.language,
        cues: parsed.cues,
        styles: parsed.styles,
        source: {
          label,
          mimeType: file.type || undefined,
          metadata: {
            fileName: file.name,
            lastModified: file.lastModified,
            size: file.size,
            ...options.metadata,
          },
        },
      },
    },
    warnings: parsed.warnings,
  };
}

export { createTimelineCaptionFileAsset as createTimelineTextFileAsset };

export async function parseTimelineCaptions(
  input: string,
  options: TimelineTextParseOptions & {
    backend?: TimelineComputeBackend;
    signal?: AbortSignal;
  } = {},
): Promise<TimelineTextParseResult> {
  const task = {
    domain: "captions",
    operation: "parse",
    input,
    options: {
      format: options.format,
      sourceLabel: options.sourceLabel,
      mimeType: options.mimeType,
    },
  } as const;

  if (options.backend?.supports(task)) {
    return options.backend.run<TimelineTextParseResult>(task, { signal: options.signal });
  }

  return parseTimelineText(input, options);
}

export function createTimelineCaptionsBrowserBackend(options: { workerUrl?: URL | string } = {}) {
  return createTimelineBrowserWasmBackend({
    worker: () =>
      new Worker(options.workerUrl ?? new URL("./worker.js", import.meta.url), {
        type: "module",
      }),
  });
}

export async function createTimelineCaptionSource(file: File): Promise<TimelineComputeSource> {
  return {
    type: "bytes",
    bytes: await file.arrayBuffer(),
    label: file.name,
    mimeType: file.type || undefined,
  };
}

function createTimelineCaptionFileAssetId(label: string) {
  const slug = label
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");

  return slug ? `subtitle-${slug}` : "subtitle-file";
}
