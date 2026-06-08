import { createElement, useRef } from "react";

import type { TimelineEditorItem } from "./core";
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
import type {
  TimelineMediaDisplayRange,
  TimelineMediaFit,
  TimelineMediaSourceCleanup,
  TimelineMediaSourceLibrary,
  TimelineMediaSourceRef,
  TimelineMediaSourceRegistry,
} from "./media-types";
import { createTimelineMediaObjectUrl } from "./media-types";

export type TimelineVideoItemData = TimelineMediaDisplayRange & {
  mediaType: "video";
  source?: TimelineMediaSourceRef;
  width?: number;
  height?: number;
  poster?: string;
  thumbnails?: string[];
  fit?: TimelineMediaFit;
  muted?: boolean;
  volume?: number;
  data?: Record<string, unknown>;
};

export type TimelineVideoFileAssetOptions = {
  id?: string;
  label?: string;
  durationMs?: number;
  width?: number;
  height?: number;
  poster?: string;
  thumbnails?: string[];
  thumbnailCount?: number;
  thumbnailTimesMs?: number[];
  color?: string;
  fit?: TimelineMediaFit;
  muted?: boolean;
  volume?: number;
  sourceId?: string;
  metadata?: Record<string, unknown>;
  createObjectUrl?: (file: File) => string;
  sourceRegistry?: TimelineMediaSourceRegistry;
  sourceLibrary?: TimelineMediaSourceLibrary;
  generatePoster?: boolean;
  posterTimeMs?: number;
  thumbnailMimeType?: string;
  thumbnailQuality?: number;
};

export type TimelineVideoFileAssetResult = {
  asset: TimelineWorkbenchAsset<TimelineVideoItemData>;
  objectUrl?: string;
  cleanup?: TimelineMediaSourceCleanup;
  revoke?: () => void;
};

export type {
  TimelineMediaDisplayRange,
  TimelineMediaFit,
  TimelineMediaSourceRef,
} from "./media-types";

export function createTimelineVideoExtension(): TimelineEditorExtension<TimelineVideoItemData> {
  return {
    id: "timeline-video",
    itemKinds: ["video"],
    mediaTypes: ["video"],
    renderItem: ({ item, itemWidthPx }) => createTimelineVideoClipContent({ item, itemWidthPx }),
    renderPreview: (context) =>
      createElement(TimelineVideoPreview, {
        currentTimeMs: context.currentTimeMs,
        items: context.items,
        transport: context.transport,
      }),
  };
}

export async function createTimelineVideoFileAsset(
  file: File,
  options: TimelineVideoFileAssetOptions = {},
): Promise<TimelineVideoFileAssetResult> {
  const sourceLifecycle = createTimelineMediaObjectUrl(file, {
    createObjectUrl: options.createObjectUrl,
  });
  const objectUrl = sourceLifecycle.objectUrl;
  const label = options.label ?? file.name;
  const shouldProbeMetadata =
    options.durationMs === undefined || options.width === undefined || options.height === undefined;
  const shouldGeneratePoster = options.poster === undefined && options.generatePoster !== false;
  const shouldGenerateThumbnails =
    options.thumbnails === undefined &&
    ((options.thumbnailCount ?? 0) > 0 || (options.thumbnailTimesMs?.length ?? 0) > 0);
  const metadata: TimelineVideoMetadata =
    objectUrl && (shouldProbeMetadata || shouldGeneratePoster || shouldGenerateThumbnails)
      ? await loadTimelineVideoMetadata(objectUrl, {
          generatePoster: shouldGeneratePoster,
          generateThumbnails: shouldGenerateThumbnails,
          posterTimeMs: options.posterTimeMs,
          thumbnailCount: options.thumbnailCount,
          thumbnailTimesMs: options.thumbnailTimesMs,
          thumbnailMimeType: options.thumbnailMimeType,
          thumbnailQuality: options.thumbnailQuality,
        }).catch((): TimelineVideoMetadata => ({}))
      : {};
  const durationMs = options.durationMs ?? metadata.durationMs ?? 1_000;
  const width = options.width ?? metadata.width;
  const height = options.height ?? metadata.height;
  const poster = options.poster ?? metadata.poster;
  const thumbnails = options.thumbnails ?? metadata.thumbnails;
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
      width,
      height,
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
      id: options.id ?? createTimelineVideoFileAssetId(label),
      label,
      kind: "video",
      mediaType: "video",
      durationMs,
      color: options.color,
      description: file.type || "Video file",
      data: {
        mediaType: "video",
        source,
        width,
        height,
        poster,
        thumbnails,
        fit: options.fit,
        muted: options.muted,
        volume: options.volume,
      },
    },
    objectUrl,
    cleanup,
    revoke: cleanup,
  };
}

function TimelineVideoPreview({
  currentTimeMs,
  items,
  transport,
}: {
  currentTimeMs: number;
  items: Array<TimelineEditorItem<TimelineVideoItemData>>;
  transport: TimelinePreviewTransportContext;
}) {
  return createElement(
    "div",
    {
      "data-slot": "timeline-media-video-preview",
      className: "grid h-full w-full place-items-center gap-2 text-white",
    },
    items.map((item) => {
      const source = item.data?.source;

      return source?.uri
        ? createElement(TimelineVideoPreviewPlayer, {
            key: item.id,
            currentTimeMs,
            item,
            poster: item.data?.poster,
            sourceEndMs: item.data?.sourceEndMs,
            sourceStartMs: item.data?.sourceStartMs,
            src: source.uri,
            transport,
          })
        : createElement(
            "div",
            {
              key: item.id,
              "data-slot": "timeline-media-video-preview-source",
              className: "text-xs text-white/60",
            },
            "No video source",
          );
    }),
  );
}

function TimelineVideoPreviewPlayer({
  currentTimeMs,
  item,
  poster,
  sourceEndMs,
  sourceStartMs,
  src,
  transport,
}: {
  currentTimeMs: number;
  item: TimelineEditorItem<TimelineVideoItemData>;
  poster?: string;
  sourceEndMs?: number;
  sourceStartMs?: number;
  src: string;
  transport: TimelinePreviewTransportContext;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sync = useTimelineWorkbenchSynchronizedMediaElement({
    elementRef: videoRef,
    item: item as TimelineEditorItem<unknown>,
    transport,
    currentTimeMs,
    sourceStartMs,
    sourceEndMs,
    muted: item.data?.muted,
    volume: item.data?.volume,
  });
  const mediaStatus = useTimelineWorkbenchMediaElementStatus(videoRef, src);
  const mediaStateMessage = createTimelineVideoMediaStateMessage(
    mediaStatus.status,
    mediaStatus.errorCode,
    sync.blocked,
  );

  return createElement(
    "div",
    { className: "grid h-full w-full place-items-center gap-1" },
    createElement("video", {
      ref: videoRef,
      controls: true,
      "data-slot": "timeline-media-video-preview-player",
      className: "max-h-full max-w-full",
      muted: item.data?.muted,
      playsInline: true,
      poster,
      preload: "metadata",
      src,
      style: { objectFit: item.data?.fit ?? "contain" },
    }),
    mediaStateMessage
      ? createElement(
          "div",
          {
            "data-slot": sync.blocked ? "timeline-media-playback-blocked" : "timeline-media-state",
            className: "text-xs text-white/60",
          },
          mediaStateMessage,
        )
      : null,
  );
}

type TimelineVideoClipDensity = "full" | "compact" | "minimal";

function createTimelineVideoClipContent({
  item,
  itemWidthPx,
}: {
  item: TimelineEditorItem<TimelineVideoItemData>;
  itemWidthPx?: number;
}) {
  const density = getTimelineVideoClipDensity(itemWidthPx);
  const sourceRange = getTimelineVideoVisibleSourceRange(item);
  const visual = createTimelineVideoVisual({ density, item, itemWidthPx, sourceRange });
  const hasVisual = Boolean(item.data?.thumbnails?.length || item.data?.poster);
  const showLabel = density !== "minimal";
  const showSource = density === "full" && Boolean(item.data?.source?.label);
  const showIdentity = density === "minimal" && !hasVisual;

  return createElement(
    "span",
    {
      "data-slot": "timeline-media-video-clip",
      className: "relative flex min-w-0 flex-1 self-stretch overflow-hidden rounded-sm bg-black/20",
    },
    visual,
    hasVisual
      ? createElement("span", {
          "aria-hidden": true,
          "data-slot": "timeline-media-video-scrim",
          className:
            "pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 to-black/10",
        })
      : null,
    sourceRange.sourceStartMs > 0
      ? createElement("span", {
          "aria-hidden": true,
          "data-slot": "timeline-media-video-trim-start",
          className: "pointer-events-none absolute inset-y-0 left-0 z-10 w-px bg-white/70",
        })
      : null,
    sourceRange.sourceEndMs < sourceRange.sourceDurationMs
      ? createElement("span", {
          "aria-hidden": true,
          "data-slot": "timeline-media-video-trim-end",
          className: "pointer-events-none absolute inset-y-0 right-0 z-10 w-px bg-white/70",
        })
      : null,
    showLabel || showSource || showIdentity
      ? createElement(
          "span",
          {
            "data-slot": "timeline-media-video-label-row",
            className:
              "pointer-events-none absolute inset-x-1 bottom-1 z-10 grid min-w-0 gap-0.5 text-white",
          },
          showLabel
            ? createElement(
                "span",
                {
                  "data-slot": "timeline-media-video-label",
                  className: "truncate text-xs font-medium leading-tight",
                },
                item.label,
              )
            : null,
          showSource
            ? createElement(
                "span",
                {
                  "data-slot": "timeline-media-video-source",
                  className: "truncate text-[10px] leading-tight text-white/75",
                },
                item.data?.source?.label,
              )
            : null,
          showIdentity
            ? createElement(
                "span",
                {
                  "aria-hidden": true,
                  "data-slot": "timeline-media-video-identity",
                  className:
                    "mx-auto inline-flex size-4 shrink-0 items-center justify-center rounded-sm bg-black/30 text-[10px] font-semibold uppercase leading-none text-white/90",
                },
                getTimelineVideoClipIdentity(item),
              )
            : null,
        )
      : null,
  );
}

function createTimelineVideoVisual({
  density,
  item,
  itemWidthPx,
  sourceRange,
}: {
  density: TimelineVideoClipDensity;
  item: TimelineEditorItem<TimelineVideoItemData>;
  itemWidthPx?: number;
  sourceRange: { sourceDurationMs: number; sourceStartMs: number; sourceEndMs: number };
}) {
  const thumbnails = item.data?.thumbnails ?? [];

  if (thumbnails.length > 0) {
    const sampledThumbnails = getTimelineVideoSampledThumbnails({
      density,
      itemWidthPx,
      sourceRange,
      thumbnails,
    });

    return createElement(
      "span",
      {
        "aria-hidden": true,
        "data-slot": "timeline-media-video-visual",
        className: "absolute inset-0 flex overflow-hidden",
      },
      createElement(
        "span",
        {
          "aria-hidden": true,
          "data-slot": "timeline-media-video-thumbnails",
          className: "flex h-full w-full overflow-hidden",
        },
        sampledThumbnails.map((thumbnail, index) =>
          createElement("img", {
            key: `${thumbnail}-${index}`,
            alt: "",
            "data-slot": "timeline-media-video-thumbnail",
            className: "h-full min-w-0 flex-1 object-cover",
            src: thumbnail,
          }),
        ),
      ),
    );
  }

  if (item.data?.poster) {
    return createElement(
      "span",
      {
        "aria-hidden": true,
        "data-slot": "timeline-media-video-visual",
        className: "absolute inset-0 overflow-hidden",
      },
      createElement("img", {
        alt: "",
        "aria-hidden": true,
        "data-slot": "timeline-media-video-poster",
        className: "h-full w-full object-cover",
        src: item.data.poster,
      }),
    );
  }

  return createElement("span", {
    "aria-hidden": true,
    "data-slot": "timeline-media-video-visual",
    className: "absolute inset-0 bg-black/20",
  });
}

function getTimelineVideoClipDensity(itemWidthPx?: number): TimelineVideoClipDensity {
  if (itemWidthPx !== undefined && Number.isFinite(itemWidthPx) && itemWidthPx < 64) {
    return "minimal";
  }

  if (itemWidthPx !== undefined && Number.isFinite(itemWidthPx) && itemWidthPx < 140) {
    return "compact";
  }

  return "full";
}

function getTimelineVideoSampledThumbnails({
  density,
  itemWidthPx,
  sourceRange,
  thumbnails,
}: {
  density: TimelineVideoClipDensity;
  itemWidthPx?: number;
  sourceRange: { sourceDurationMs: number; sourceStartMs: number; sourceEndMs: number };
  thumbnails: string[];
}) {
  const tileCount =
    density === "minimal" ? 1 : Math.max(1, Math.min(12, Math.floor((itemWidthPx ?? 48) / 48)));
  const startRatio = sourceRange.sourceStartMs / sourceRange.sourceDurationMs;
  const endRatio = sourceRange.sourceEndMs / sourceRange.sourceDurationMs;
  const safeStartRatio = clampTimelineVideoRatio(startRatio);
  const safeEndRatio = Math.max(safeStartRatio, clampTimelineVideoRatio(endRatio));
  const ratioSpan = safeEndRatio - safeStartRatio;

  return Array.from({ length: tileCount }, (_, tileIndex) => {
    const tileRatio =
      tileCount === 1
        ? safeStartRatio + ratioSpan / 2
        : safeStartRatio + (ratioSpan * tileIndex) / (tileCount - 1);
    const thumbnailIndex = Math.max(
      0,
      Math.min(thumbnails.length - 1, Math.round(tileRatio * (thumbnails.length - 1))),
    );

    return thumbnails[thumbnailIndex] ?? thumbnails[0]!;
  });
}

function getTimelineVideoVisibleSourceRange(item: TimelineEditorItem<TimelineVideoItemData>) {
  const sourceDurationMs = getTimelineVideoSourceDurationMs(item);
  const sourceStartMs = clampTimelineVideoTime(
    toTimelineVideoNumber(item.data?.sourceStartMs) ?? 0,
    0,
    sourceDurationMs,
  );
  const defaultEndMs = sourceStartMs + item.durationMs;
  const sourceEndMs = clampTimelineVideoTime(
    toTimelineVideoNumber(item.data?.sourceEndMs) ?? defaultEndMs,
    sourceStartMs,
    sourceDurationMs,
  );

  return { sourceDurationMs, sourceStartMs, sourceEndMs };
}

function getTimelineVideoSourceDurationMs(item: TimelineEditorItem<TimelineVideoItemData>) {
  return Math.max(
    1,
    toTimelineVideoNumber(item.data?.source?.metadata?.durationMs) ??
      toTimelineVideoNumber(item.data?.sourceEndMs) ??
      item.durationMs,
  );
}

function toTimelineVideoNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clampTimelineVideoTime(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampTimelineVideoRatio(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function getTimelineVideoClipIdentity(item: TimelineEditorItem<TimelineVideoItemData>) {
  return (item.kind?.trim().charAt(0) || item.label.trim().charAt(0) || "?").toUpperCase();
}

function createTimelineVideoFileAssetId(label: string) {
  const slug = label
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");

  return slug ? `video-${slug}` : "video-file";
}

type TimelineVideoMetadata = {
  durationMs?: number;
  width?: number;
  height?: number;
  poster?: string;
  thumbnails?: string[];
};

type TimelineVideoMetadataOptions = {
  generatePoster?: boolean;
  generateThumbnails?: boolean;
  posterTimeMs?: number;
  thumbnailCount?: number;
  thumbnailTimesMs?: number[];
  thumbnailMimeType?: string;
  thumbnailQuality?: number;
};

function loadTimelineVideoMetadata(
  uri: string,
  options: TimelineVideoMetadataOptions,
): Promise<TimelineVideoMetadata> {
  if (typeof document === "undefined") {
    return Promise.resolve({});
  }

  return new Promise<TimelineVideoMetadata>((resolve) => {
    const video = document.createElement("video");
    let settled = false;
    const timeout = globalThis.setTimeout(() => settle({}), 4_000);
    const cleanup = () => {
      globalThis.clearTimeout(timeout);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      try {
        video.load();
      } catch {
        // Some test DOM implementations expose media elements without load support.
      }
    };
    const settle = (metadata: TimelineVideoMetadata) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(metadata);
    };

    video.preload = options.generatePoster || options.generateThumbnails ? "auto" : "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      void (async () => {
        const durationMs = Number.isFinite(video.duration)
          ? Math.max(1, Math.round(video.duration * 1_000))
          : undefined;
        const width =
          Number.isFinite(video.videoWidth) && video.videoWidth > 0
            ? Math.round(video.videoWidth)
            : undefined;
        const height =
          Number.isFinite(video.videoHeight) && video.videoHeight > 0
            ? Math.round(video.videoHeight)
            : undefined;
        const metadata: TimelineVideoMetadata = { durationMs, width, height };

        if (canCaptureTimelineVideoFrame(video)) {
          if (options.generatePoster) {
            metadata.poster = await captureTimelineVideoFrame(video, {
              timeMs: options.posterTimeMs ?? 0,
              mimeType: options.thumbnailMimeType,
              quality: options.thumbnailQuality,
            }).catch(() => undefined);
          }

          if (options.generateThumbnails) {
            const thumbnailTimes = getTimelineVideoThumbnailTimesMs({
              durationMs,
              thumbnailCount: options.thumbnailCount,
              thumbnailTimesMs: options.thumbnailTimesMs,
            });
            const thumbnails = await captureTimelineVideoFrames(video, thumbnailTimes, {
              mimeType: options.thumbnailMimeType,
              quality: options.thumbnailQuality,
            });

            if (thumbnails.length > 0) {
              metadata.thumbnails = thumbnails;
            }
          }
        }

        settle(metadata);
      })();
    };
    video.onerror = () => settle({});
    video.src = uri;
    try {
      video.load();
    } catch {
      settle({});
    }
  });
}

function canCaptureTimelineVideoFrame(video: HTMLVideoElement) {
  return (
    typeof document !== "undefined" &&
    Number.isFinite(video.videoWidth) &&
    video.videoWidth > 0 &&
    Number.isFinite(video.videoHeight) &&
    video.videoHeight > 0
  );
}

function captureTimelineVideoFrame(
  video: HTMLVideoElement,
  options: {
    timeMs: number;
    mimeType?: string;
    quality?: number;
  },
) {
  return new Promise<string | undefined>((resolve) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context || typeof canvas.toDataURL !== "function") {
      resolve(undefined);
      return;
    }

    const width = Math.max(1, Math.round(video.videoWidth));
    const height = Math.max(1, Math.round(video.videoHeight));
    canvas.width = width;
    canvas.height = height;

    seekTimelineVideo(video, options.timeMs)
      .then(() => {
        context.drawImage(video, 0, 0, width, height);
        resolve(canvas.toDataURL(options.mimeType ?? "image/jpeg", options.quality ?? 0.82));
      })
      .catch(() => resolve(undefined));
  });
}

function captureTimelineVideoFrames(
  video: HTMLVideoElement,
  timesMs: number[],
  options: {
    mimeType?: string;
    quality?: number;
  },
) {
  return timesMs.reduce<Promise<string[]>>(async (previousThumbnails, timeMs) => {
    const thumbnails = await previousThumbnails;
    const thumbnail = await captureTimelineVideoFrame(video, {
      timeMs,
      mimeType: options.mimeType,
      quality: options.quality,
    }).catch(() => undefined);

    return thumbnail ? [...thumbnails, thumbnail] : thumbnails;
  }, Promise.resolve([]));
}

function seekTimelineVideo(video: HTMLVideoElement, timeMs: number) {
  return new Promise<void>((resolve) => {
    let settled = false;
    const durationMs = Number.isFinite(video.duration) ? video.duration * 1_000 : undefined;
    const clampedTimeMs = Math.max(0, Math.min(timeMs, durationMs ?? timeMs));
    const timeSeconds = clampedTimeMs / 1_000;
    const timeout = globalThis.setTimeout(() => settle(), 2_000);
    const cleanup = () => {
      globalThis.clearTimeout(timeout);
      video.removeEventListener("loadeddata", settle);
      video.removeEventListener("seeked", settle);
      video.removeEventListener("error", settle);
    };
    const settle = () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve();
    };

    if (Math.abs(video.currentTime - timeSeconds) < 0.01 && video.readyState >= 2) {
      settle();
      return;
    }

    video.addEventListener("loadeddata", settle, { once: true });
    video.addEventListener("seeked", settle, { once: true });
    video.addEventListener("error", settle, { once: true });
    try {
      video.currentTime = timeSeconds;
    } catch {
      settle();
    }
  });
}

function getTimelineVideoThumbnailTimesMs({
  durationMs,
  thumbnailCount,
  thumbnailTimesMs,
}: {
  durationMs?: number;
  thumbnailCount?: number;
  thumbnailTimesMs?: number[];
}) {
  if (thumbnailTimesMs?.length) {
    return thumbnailTimesMs.filter((timeMs) => Number.isFinite(timeMs) && timeMs >= 0);
  }

  const count = Math.max(0, Math.floor(thumbnailCount ?? 0));

  if (count <= 0) {
    return [];
  }

  if (!durationMs || durationMs <= 1) {
    return Array.from({ length: count }, () => 0);
  }

  return Array.from({ length: count }, (_, index) => {
    const ratio = (index + 0.5) / count;

    return Math.max(0, Math.min(durationMs - 1, Math.round(durationMs * ratio)));
  });
}

function createTimelineVideoMediaStateMessage(
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
