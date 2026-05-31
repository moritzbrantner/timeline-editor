import { createElement, useRef } from "react";

import type { TimelineEditorItem } from "./core";
import type {
  TimelineEditorExtension,
  TimelinePreviewTransportContext,
} from "./react/workbench/types";
import type { TimelineWorkbenchAsset } from "./react/workbench/types";
import { useTimelineWorkbenchSynchronizedMediaElement } from "./react/workbench/use-synchronized-media";
import type {
  TimelineMediaDisplayRange,
  TimelineMediaFit,
  TimelineMediaSourceCleanup,
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
    renderItem: ({ item }) =>
      createElement(
        "span",
        { className: "grid min-w-0 gap-0.5" },
        createElement("span", { className: "truncate" }, item.label),
        item.data?.source?.label
          ? createElement(
              "span",
              { className: "truncate text-[10px] text-white/70" },
              item.data.source.label,
            )
          : null,
        createTimelineVideoStrip(item.data),
      ),
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
  const registeredSource = options.sourceRegistry
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

function createTimelineVideoStrip(data: TimelineVideoItemData | undefined) {
  const thumbnails = data?.thumbnails ?? [];

  if (thumbnails.length > 0) {
    return createElement(
      "span",
      {
        "aria-hidden": true,
        "data-slot": "timeline-media-video-thumbnails",
        className: "flex h-4 overflow-hidden rounded-sm",
      },
      thumbnails.slice(0, 5).map((thumbnail, index) =>
        createElement("img", {
          key: index,
          alt: "",
          className: "h-full min-w-6 object-cover",
          src: thumbnail,
        }),
      ),
    );
  }

  if (!data?.poster) {
    return null;
  }

  return createElement("img", {
    alt: "",
    "aria-hidden": true,
    "data-slot": "timeline-media-video-poster",
    className: "h-4 w-full rounded-sm object-cover",
    src: data.poster,
  });
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
