import { createElement, useRef } from "react";

import type { TimelineEditorItem } from "./core";
import type {
  TimelineEditorExtension,
  TimelinePreviewTransportContext,
} from "./react/workbench/types";
import { useTimelineWorkbenchSynchronizedMediaElement } from "./react/workbench/use-synchronized-media";
import type {
  TimelineMediaDisplayRange,
  TimelineMediaFit,
  TimelineMediaSourceRef,
} from "./media-types";

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
        durationMs: context.durationMs,
        items: context.items,
        transport: context.transport,
      }),
  };
}

function TimelineVideoPreview({
  currentTimeMs,
  durationMs,
  items,
  transport,
}: {
  currentTimeMs: number;
  durationMs: number;
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
            durationMs,
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
  durationMs,
  item,
  poster,
  sourceEndMs,
  sourceStartMs,
  src,
  transport,
}: {
  currentTimeMs: number;
  durationMs: number;
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
    durationMs,
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
