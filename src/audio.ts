import { createElement, useEffect, useRef } from "react";

import type { TimelineEditorItem } from "./core";
import type {
  TimelineEditorExtension,
  TimelinePreviewTransportContext,
} from "./react/workbench/types";
import type { TimelineWorkbenchAsset } from "./react/workbench/types";
import { useTimelineWorkbenchSynchronizedMediaElement } from "./react/workbench/use-synchronized-media";
import type { TimelineMediaDisplayRange, TimelineMediaSourceRef } from "./media-types";

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
};

export type TimelineAudioFileAssetResult = {
  asset: TimelineWorkbenchAsset<TimelineAudioItemData>;
  objectUrl?: string;
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
    renderItem: ({ item }) =>
      createElement(
        "span",
        { className: "grid min-w-0 gap-0.5" },
        createElement("span", { className: "truncate" }, item.label),
        createElement(
          "span",
          { className: "flex min-w-0 items-center gap-1 text-[10px] text-white/70" },
          item.data?.source?.label
            ? createElement("span", { className: "truncate" }, item.data.source.label)
            : null,
          getTimelineAudioStateLabel(item.data)
            ? createElement(
                "span",
                { className: "shrink-0" },
                getTimelineAudioStateLabel(item.data),
              )
            : null,
        ),
        item.data?.waveform?.length
          ? createTimelineAudioWaveform(item.data.waveform, item.data.color)
          : null,
      ),
    renderPreview:
      options.renderPreview ??
      ((context) =>
        createElement(TimelineAudioPreview, {
          currentTimeMs: context.currentTimeMs,
          durationMs: context.durationMs,
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
  const createObjectUrl =
    options.createObjectUrl ??
    (typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
      ? (source: File) => URL.createObjectURL(source)
      : undefined);
  const objectUrl = createObjectUrl?.(file);
  const label = options.label ?? file.name;
  const durationMs =
    options.durationMs ??
    (objectUrl ? await loadTimelineAudioDurationMs(objectUrl).catch(() => undefined) : undefined) ??
    1_000;
  const source: TimelineMediaSourceRef = {
    id: options.sourceId,
    uri: objectUrl,
    label,
    mimeType: file.type || undefined,
    metadata: {
      fileName: file.name,
      lastModified: file.lastModified,
      size: file.size,
      ...options.metadata,
    },
  };

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
        waveform: options.waveform,
        color: options.color,
      },
    },
    objectUrl,
    revoke:
      objectUrl && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function"
        ? () => URL.revokeObjectURL(objectUrl)
        : undefined,
  };
}

function TimelineAudioPreview({
  currentTimeMs,
  durationMs,
  items,
  resolvePreviewSource,
  transport,
}: {
  currentTimeMs: number;
  durationMs: number;
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
              durationMs,
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
  durationMs,
  item,
  muted,
  sourceEndMs,
  sourceStartMs,
  src,
  transport,
  volume,
}: {
  currentTimeMs: number;
  durationMs: number;
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
    durationMs,
    sourceStartMs,
    sourceEndMs,
    muted,
    volume,
  });

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
    sync.blocked
      ? createElement(
          "div",
          {
            "data-slot": "timeline-media-playback-blocked",
            className: "text-xs text-white/60",
          },
          "Media playback blocked",
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

  return data.volume === undefined ? undefined : `${Math.round(data.volume * 100)}%`;
}

function createTimelineAudioWaveform(waveform: number[], color?: string) {
  return createElement(
    "span",
    {
      "aria-hidden": true,
      "data-slot": "timeline-media-audio-waveform",
      className: "flex h-3 items-end gap-px",
    },
    waveform.slice(0, 48).map((value, index) =>
      createElement("span", {
        key: index,
        className: "w-px rounded bg-white/70",
        style: {
          backgroundColor: color,
          height: `${Math.max(2, Math.round(Math.max(0, Math.min(1, value)) * 12))}px`,
        },
      }),
    ),
  );
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
