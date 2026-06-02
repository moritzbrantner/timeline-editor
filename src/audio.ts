import { createElement, useEffect, useRef } from "react";

import { formatTimelineEditorTimeMs, type TimelineEditorItem } from "./core";
import type {
  TimelineEditorExtension,
  TimelineWorkbenchMediaErrorCode,
  TimelineWorkbenchMediaStatus,
  TimelinePreviewTransportContext,
} from "./react/workbench/types";
import type { TimelineWorkbenchAsset } from "./react/workbench/types";
import {
  useTimelineWorkbenchMediaElementStatus,
  useTimelineWorkbenchSynchronizedMediaElement,
} from "./react/workbench/use-synchronized-media";
import {
  createTimelineMediaObjectUrl,
  type TimelineMediaDisplayRange,
  type TimelineMediaSourceCleanup,
  type TimelineMediaSourceLibrary,
  type TimelineMediaSourceRef,
  type TimelineMediaSourceRegistry,
} from "./media-types";

export type TimelineAudioItemData = TimelineMediaDisplayRange & {
  mediaType: "audio";
  source?: TimelineMediaSourceRef;
  volume?: number;
  muted?: boolean;
  channels?: number;
  sampleRate?: number;
  waveform?: number[];
  color?: string;
  data?: Record<string, unknown>;
};

export type { TimelineMediaDisplayRange, TimelineMediaSourceRef } from "./media-types";

export type TimelineAudioWaveform = number[];

export type TimelineAudioWaveformOptions = {
  sampleCount?: number;
  normalize?: boolean;
};

export type TimelineAudioMetadata = {
  durationMs?: number;
  channels?: number;
  sampleRate?: number;
  waveform?: TimelineAudioWaveform;
};

export type TimelineAudioPreviewSourceResolver = (
  item: TimelineEditorItem<TimelineAudioItemData>,
) => TimelineMediaSourceRef | undefined;

export type TimelineAudioExtensionOptions = {
  resolvePreviewSource?: TimelineAudioPreviewSourceResolver;
  renderPreview?: TimelineEditorExtension<TimelineAudioItemData>["renderPreview"];
};

export type TimelineAudioFileAssetOptions = {
  id?: string;
  label?: string;
  durationMs?: number;
  color?: string;
  waveform?: number[];
  sourceId?: string;
  metadata?: Record<string, unknown>;
  createObjectUrl?: (file: File) => string;
  sourceRegistry?: TimelineMediaSourceRegistry;
  sourceLibrary?: TimelineMediaSourceLibrary;
  generateWaveform?: boolean;
  waveformSampleCount?: number;
  normalizeWaveform?: boolean;
};

export type TimelineAudioFileAssetResult = {
  asset: TimelineWorkbenchAsset<TimelineAudioItemData>;
  objectUrl?: string;
  cleanup?: TimelineMediaSourceCleanup;
  revoke?: () => void;
};

export function createTimelineAudioExtension(
  options: TimelineAudioExtensionOptions = {},
): TimelineEditorExtension<TimelineAudioItemData> {
  const resolvePreviewSource = options.resolvePreviewSource ?? getTimelineAudioPreviewSource;

  return {
    id: "timeline-audio",
    itemKinds: ["audio"],
    mediaTypes: ["audio"],
    renderItem: ({ item }) => {
      const metadataLabel = getTimelineAudioClipMetadataLabel(item);

      return createElement(
        "span",
        { className: "grid min-w-0 flex-1 gap-1" },
        createElement("span", { className: "truncate leading-tight" }, item.label),
        metadataLabel
          ? createElement(
              "span",
              {
                "data-slot": "timeline-media-audio-metadata",
                className: "truncate text-[10px] leading-tight text-white/75",
              },
              metadataLabel,
            )
          : null,
        item.data?.waveform?.length
          ? createTimelineAudioWaveform(item.data.waveform, item.data.color ?? item.color)
          : null,
      );
    },
    inspectorSections: [renderTimelineAudioInspectorSection],
    renderPreview:
      options.renderPreview ??
      ((context) =>
        createElement(TimelineAudioPreview, {
          currentTimeMs: context.currentTimeMs,
          items: context.items,
          resolvePreviewSource,
          transport: context.transport,
        })),
  };
}

export async function createTimelineAudioFileAsset(
  file: File,
  options: TimelineAudioFileAssetOptions = {},
): Promise<TimelineAudioFileAssetResult> {
  const sourceLifecycle = createTimelineMediaObjectUrl(file, {
    createObjectUrl: options.createObjectUrl,
  });
  const objectUrl = sourceLifecycle.objectUrl;
  const label = options.label ?? file.name;
  const shouldGenerateWaveform =
    options.waveform === undefined && options.generateWaveform !== false;
  const audioMetadata = shouldGenerateWaveform
    ? await loadTimelineAudioMetadata(file, {
        sampleCount: options.waveformSampleCount,
        normalize: options.normalizeWaveform,
      }).catch((): TimelineAudioMetadata => ({}))
    : {};
  const durationMs =
    options.durationMs ??
    audioMetadata.durationMs ??
    (objectUrl ? await loadTimelineAudioDurationMs(objectUrl).catch(() => undefined) : undefined) ??
    1_000;
  const waveform = options.waveform ?? audioMetadata.waveform;
  const channels = audioMetadata.channels;
  const sampleRate = audioMetadata.sampleRate;
  const source: TimelineMediaSourceRef = {
    id: options.sourceId,
    uri: objectUrl,
    label,
    mimeType: file.type || undefined,
    metadata: {
      fileName: file.name,
      lastModified: file.lastModified,
      size: file.size,
      durationMs,
      channels,
      sampleRate,
      ...options.metadata,
    },
  };
  const registeredSource = options.sourceLibrary
    ? options.sourceLibrary.register(source, sourceLifecycle)
    : options.sourceRegistry
      ? options.sourceRegistry.register(source, sourceLifecycle)
      : undefined;
  const cleanup = registeredSource?.cleanup ?? sourceLifecycle.cleanup;

  return {
    asset: {
      id: options.id ?? createTimelineAudioFileAssetId(label),
      label,
      kind: "audio",
      mediaType: "audio",
      durationMs,
      color: options.color,
      description: file.type || "Audio file",
      data: {
        mediaType: "audio",
        source,
        waveform,
        channels,
        sampleRate,
        color: options.color,
      },
    },
    objectUrl,
    cleanup,
    revoke: cleanup,
  };
}

export async function loadTimelineAudioMetadata(
  file: File,
  options: TimelineAudioWaveformOptions = {},
): Promise<TimelineAudioMetadata> {
  const AudioContextConstructor = getTimelineAudioContextConstructor();

  if (!AudioContextConstructor) {
    return {};
  }

  let audioContext: AudioContext | undefined;

  try {
    audioContext = new AudioContextConstructor();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const durationMs = Number.isFinite(audioBuffer.duration)
      ? Math.max(1, Math.round(audioBuffer.duration * 1_000))
      : undefined;

    return {
      durationMs,
      channels:
        Number.isFinite(audioBuffer.numberOfChannels) && audioBuffer.numberOfChannels > 0
          ? Math.round(audioBuffer.numberOfChannels)
          : undefined,
      sampleRate:
        Number.isFinite(audioBuffer.sampleRate) && audioBuffer.sampleRate > 0
          ? Math.round(audioBuffer.sampleRate)
          : undefined,
      waveform: createTimelineAudioWaveformFromAudioBuffer(audioBuffer, options),
    };
  } catch {
    return {};
  } finally {
    if (audioContext && typeof audioContext.close === "function") {
      await audioContext.close().catch(() => undefined);
    }
  }
}

export function createTimelineAudioWaveformFromAudioBuffer(
  audioBuffer: AudioBuffer,
  options: TimelineAudioWaveformOptions = {},
): TimelineAudioWaveform {
  const sampleCount = Math.max(1, Math.round(options.sampleCount ?? 96));
  const length = Math.max(0, audioBuffer.length);
  const channelCount = Math.max(0, audioBuffer.numberOfChannels);
  const waveform = Array.from({ length: sampleCount }, () => 0);

  if (length === 0 || channelCount === 0) {
    return waveform;
  }

  for (let bucketIndex = 0; bucketIndex < sampleCount; bucketIndex += 1) {
    const start = Math.floor((bucketIndex / sampleCount) * length);
    const end = Math.max(start + 1, Math.floor(((bucketIndex + 1) / sampleCount) * length));
    let peak = 0;

    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const channelData = audioBuffer.getChannelData(channelIndex);

      for (
        let sampleIndex = start;
        sampleIndex < end && sampleIndex < channelData.length;
        sampleIndex += 1
      ) {
        const sample = Math.abs(channelData[sampleIndex] ?? 0);

        if (Number.isFinite(sample) && sample > peak) {
          peak = sample;
        }
      }
    }

    waveform[bucketIndex] = clampTimelineAudioWaveformValue(peak);
  }

  if (options.normalize !== false) {
    const maxPeak = Math.max(...waveform);

    if (maxPeak > 0) {
      return waveform.map((value) => clampTimelineAudioWaveformValue(value / maxPeak));
    }
  }

  return waveform;
}

type TimelineAudioInspectorContext = Parameters<
  NonNullable<TimelineEditorExtension<TimelineAudioItemData>["inspectorSections"]>[number]
>[0];

function renderTimelineAudioInspectorSection(context: TimelineAudioInspectorContext) {
  const item = context.selectedItem;

  if (!item || !isTimelineAudioItem(item)) {
    return null;
  }

  const rows = getTimelineAudioInspectorRows(item);

  if (rows.length === 0) {
    return null;
  }

  return createElement(
    "section",
    {
      "data-slot": "timeline-media-audio-inspector",
      key: "timeline-media-audio-inspector",
      className: "grid gap-3 rounded border border-border bg-background p-3 text-sm",
    },
    createElement(
      "div",
      { className: "grid gap-1" },
      createElement("h2", { className: "text-sm font-semibold" }, "Audio"),
      createElement(
        "p",
        { className: "truncate text-xs text-muted-foreground" },
        item.data?.source?.label ?? item.label,
      ),
    ),
    createElement(
      "dl",
      { className: "grid gap-1 text-xs" },
      rows.map(([label, value]) =>
        createElement(
          "div",
          { key: label, className: "grid grid-cols-[minmax(5rem,0.42fr)_1fr] gap-3" },
          createElement("dt", { className: "text-muted-foreground" }, label),
          createElement("dd", { className: "min-w-0 truncate text-right" }, value),
        ),
      ),
    ),
  );
}

function getTimelineAudioInspectorRows(
  item: TimelineEditorItem<TimelineAudioItemData>,
): Array<[string, string]> {
  const data = item.data;
  const source = data?.source;
  const sourceMetadata = source?.metadata;
  const rows: Array<[string, string]> = [];
  const sourceLabel = source?.label;
  const sourceSize = toTimelineAudioNumber(sourceMetadata?.size);
  const channels = data?.channels ?? toTimelineAudioNumber(sourceMetadata?.channels);
  const sampleRate = data?.sampleRate ?? toTimelineAudioNumber(sourceMetadata?.sampleRate);
  const mimeType = source?.mimeType;

  if (sourceLabel) {
    rows.push(["Source", sourceLabel]);
  }

  if (mimeType) {
    rows.push(["MIME Type", mimeType]);
  }

  rows.push(["Duration", formatTimelineEditorTimeMs(item.durationMs)]);

  if (sourceSize !== undefined) {
    rows.push(["File Size", formatTimelineAudioFileSize(sourceSize)]);
  }

  if (channels !== undefined) {
    rows.push(["Channels", formatTimelineAudioChannels(channels)]);
  }

  if (sampleRate !== undefined) {
    rows.push(["Sample Rate", formatTimelineAudioSampleRate(sampleRate)]);
  }

  if (data?.volume !== undefined) {
    rows.push(["Volume", formatTimelineAudioVolume(data.volume)]);
  }

  if (data?.muted !== undefined) {
    rows.push(["Muted", data.muted ? "Yes" : "No"]);
  }

  return rows;
}

function getTimelineAudioClipMetadataLabel(item: TimelineEditorItem<TimelineAudioItemData>) {
  const data = item.data;
  const source = data?.source;
  const sourceMetadata = source?.metadata;
  const parts = [
    source?.label && source.label !== item.label ? source.label : undefined,
    source?.mimeType,
    formatTimelineEditorTimeMs(item.durationMs),
    formatTimelineAudioChannels(data?.channels ?? toTimelineAudioNumber(sourceMetadata?.channels)),
    formatTimelineAudioSampleRate(
      data?.sampleRate ?? toTimelineAudioNumber(sourceMetadata?.sampleRate),
    ),
    getTimelineAudioStateLabel(data),
  ].filter((part): part is string => Boolean(part));

  return parts.join(" · ");
}

function getTimelineAudioContextConstructor(): (new () => AudioContext) | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const audioWindow = window as Window &
    typeof globalThis & { webkitAudioContext?: new () => AudioContext };
  const candidate = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;

  return typeof candidate === "function" ? candidate : undefined;
}

function formatTimelineAudioChannels(channels: number): string;
function formatTimelineAudioChannels(channels: number | undefined): string | undefined;
function formatTimelineAudioChannels(channels: number | undefined) {
  if (!channels || !Number.isFinite(channels) || channels <= 0) {
    return undefined;
  }

  return `${Math.round(channels)} ch`;
}

function formatTimelineAudioSampleRate(sampleRate: number): string;
function formatTimelineAudioSampleRate(sampleRate: number | undefined): string | undefined;
function formatTimelineAudioSampleRate(sampleRate: number | undefined) {
  if (!sampleRate || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    return undefined;
  }

  return sampleRate >= 1_000
    ? `${Math.round(sampleRate / 100) / 10} kHz`
    : `${Math.round(sampleRate)} Hz`;
}

function formatTimelineAudioVolume(volume: number) {
  return `${Math.round(Math.max(0, Math.min(1, volume)) * 100)}%`;
}

function formatTimelineAudioFileSize(size: number) {
  if (!Number.isFinite(size) || size < 0) {
    return "0 B";
  }

  if (size < 1_024) {
    return `${Math.round(size)} B`;
  }

  if (size < 1_024 * 1_024) {
    return `${Math.round((size / 1_024) * 10) / 10} KB`;
  }

  return `${Math.round((size / (1_024 * 1_024)) * 10) / 10} MB`;
}

function toTimelineAudioNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clampTimelineAudioWaveformValue(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function TimelineAudioPreview({
  currentTimeMs,
  items,
  resolvePreviewSource,
  transport,
}: {
  currentTimeMs: number;
  items: Array<TimelineEditorItem<TimelineAudioItemData>>;
  resolvePreviewSource: TimelineAudioPreviewSourceResolver;
  transport: TimelinePreviewTransportContext;
}) {
  const audioItems = items.filter(isTimelineAudioItem);

  return createElement(
    "div",
    {
      "data-slot": "timeline-media-audio-preview",
      className: "grid w-full max-w-xl gap-2 text-white",
    },
    audioItems.map((item) => {
      const source = resolvePreviewSource(item);
      const sourceLabel = [source?.label, source?.mimeType].filter(Boolean).join(" · ");

      return createElement(
        "div",
        {
          key: item.id,
          "data-slot": "timeline-media-audio-preview-item",
          className: "grid gap-2 rounded border border-white/10 bg-white/10 px-3 py-2",
        },
        createElement("div", { className: "truncate text-sm font-medium" }, item.label),
        sourceLabel
          ? createElement(
              "div",
              {
                "data-slot": "timeline-media-audio-preview-source",
                className: "truncate text-xs text-white/60",
              },
              sourceLabel,
            )
          : null,
        source?.uri
          ? createElement(TimelineAudioPreviewPlayer, {
              key: source.uri,
              currentTimeMs,
              item,
              muted: item.data?.muted,
              sourceEndMs: item.data?.sourceEndMs,
              sourceStartMs: item.data?.sourceStartMs,
              src: source.uri,
              transport,
              volume: item.data?.volume,
            })
          : createElement(
              "div",
              {
                "data-slot": "timeline-media-audio-preview-source",
                className: "text-xs text-white/60",
              },
              "No audio source",
            ),
      );
    }),
  );
}

function TimelineAudioPreviewPlayer({
  currentTimeMs,
  item,
  muted,
  sourceEndMs,
  sourceStartMs,
  src,
  transport,
  volume,
}: {
  currentTimeMs: number;
  item: TimelineEditorItem<TimelineAudioItemData>;
  muted?: boolean;
  sourceEndMs?: number;
  sourceStartMs?: number;
  src: string;
  transport: TimelinePreviewTransportContext;
  volume?: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sync = useTimelineWorkbenchSynchronizedMediaElement({
    elementRef: audioRef,
    item: item as TimelineEditorItem<unknown>,
    transport,
    currentTimeMs,
    sourceStartMs,
    sourceEndMs,
    muted,
    volume,
  });
  const mediaStatus = useTimelineWorkbenchMediaElementStatus(audioRef, src);

  useEffect(() => {
    if (audioRef.current && volume !== undefined) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

  return createElement(
    "div",
    { className: "grid gap-1" },
    createElement("audio", {
      ref: audioRef,
      controls: true,
      "data-slot": "timeline-media-audio-preview-player",
      className: "w-full",
      muted,
      preload: "metadata",
      src,
    }),
    createTimelineAudioMediaStateMessage(mediaStatus.status, mediaStatus.errorCode, sync.blocked)
      ? createElement(
          "div",
          {
            "data-slot": sync.blocked ? "timeline-media-playback-blocked" : "timeline-media-state",
            className: "text-xs text-white/60",
          },
          createTimelineAudioMediaStateMessage(
            mediaStatus.status,
            mediaStatus.errorCode,
            sync.blocked,
          ),
        )
      : null,
  );
}

function getTimelineAudioPreviewSource(item: TimelineEditorItem<TimelineAudioItemData>) {
  return item.data?.source;
}

function isTimelineAudioItem(
  item: TimelineEditorItem<TimelineAudioItemData>,
): item is TimelineEditorItem<TimelineAudioItemData> {
  return item.kind === "audio" || item.data?.mediaType === "audio";
}

function getTimelineAudioStateLabel(data: TimelineAudioItemData | undefined) {
  if (!data) {
    return undefined;
  }

  if (data.muted) {
    return "Muted";
  }

  return data.volume === undefined ? undefined : formatTimelineAudioVolume(data.volume);
}

function createTimelineAudioWaveform(waveform: number[], color?: string) {
  return createElement(
    "span",
    {
      "aria-hidden": true,
      "data-slot": "timeline-media-audio-waveform",
      className: "flex h-3.5 w-full items-end gap-px overflow-hidden",
    },
    waveform.map((value, index) =>
      createElement("span", {
        key: index,
        className: "min-w-px flex-1 rounded bg-white/70",
        style: {
          backgroundColor: color,
          height: `${Math.max(2, Math.round(clampTimelineAudioWaveformValue(value) * 14))}px`,
        },
      }),
    ),
  );
}

function createTimelineAudioMediaStateMessage(
  status: TimelineWorkbenchMediaStatus,
  errorCode?: TimelineWorkbenchMediaErrorCode,
  blocked?: boolean,
) {
  if (blocked || status === "blocked") {
    return "Media playback blocked";
  }

  if (status === "stalled") {
    return "Media stalled";
  }

  if (status === "error") {
    return errorCode === "decode-failed" || errorCode === "unsupported-source"
      ? "Unsupported or corrupt media"
      : "Media source unavailable";
  }

  return undefined;
}

function createTimelineAudioFileAssetId(label: string) {
  const slug = label
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");

  return slug ? `audio-${slug}` : "audio-file";
}

function loadTimelineAudioDurationMs(uri: string) {
  if (typeof document === "undefined") {
    return Promise.resolve(undefined);
  }

  return new Promise<number | undefined>((resolve) => {
    const audio = document.createElement("audio");
    let settled = false;
    const timeout = globalThis.setTimeout(() => settle(), 4_000);
    const cleanup = () => {
      globalThis.clearTimeout(timeout);
      audio.removeAttribute("src");
      try {
        audio.load();
      } catch {
        // Some test DOM implementations expose media elements without load support.
      }
    };
    const settle = (durationMs?: number) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(durationMs);
    };

    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const durationMs = Number.isFinite(audio.duration)
        ? Math.max(1, Math.round(audio.duration * 1_000))
        : undefined;

      settle(durationMs);
    };
    audio.onerror = () => settle();
    audio.src = uri;
    try {
      audio.load();
    } catch {
      settle();
    }
  });
}
