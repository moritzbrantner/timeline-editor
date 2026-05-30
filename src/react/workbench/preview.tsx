"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

import { ToggleGroup, ToggleGroupItem } from "@moritzbrantner/ui";

import {
  formatTimelineEditorTimeMs,
  getTimelineEditorItemEndMs,
  type TimelineEditorDocument,
  type TimelineEditorItem,
  type TimelineEditorTimeRange,
  type TimelineEditorTrack,
} from "../../core";
import { getTimelineMediaTypeForItem } from "../../media-types";
import { getTimelineTextDisplayText } from "../../text";
import type {
  TimelineEditorExtension,
  TimelinePreviewTransportContext,
  TimelineWorkbenchPreviewMode,
} from "./types";
import { useTimelineWorkbenchSynchronizedMediaElement } from "./use-synchronized-media";

type TimelineWorkbenchPreviewProps<
  TTrackData extends Record<string, unknown>,
  TItemData,
  TAssetData,
> = {
  currentTimeMs: number;
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
  extensions?: Array<TimelineEditorExtension<TItemData, TTrackData, TAssetData>>;
  mode: TimelineWorkbenchPreviewMode;
  loopRange?: TimelineEditorTimeRange;
  readOnly: boolean;
  selectedItems: Array<TimelineEditorItem<TItemData>>;
  transport: TimelinePreviewTransportContext;
  onModeChange: (mode: TimelineWorkbenchPreviewMode) => void;
};

export function TimelineWorkbenchPreview<
  TTrackData extends Record<string, unknown>,
  TItemData,
  TAssetData,
>({
  currentTimeMs,
  document,
  durationMs,
  extensions = [],
  loopRange,
  mode,
  readOnly: _readOnly,
  selectedItems,
  transport,
  onModeChange,
}: TimelineWorkbenchPreviewProps<TTrackData, TItemData, TAssetData>) {
  const activeItems = document.tracks.flatMap((track) =>
    track.items
      .filter(
        (item) =>
          item.startMs <= currentTimeMs && getTimelineEditorItemEndMs(item) >= currentTimeMs,
      )
      .map((item) => ({ item, track })),
  );
  const previewItems = getTimelineWorkbenchPreviewItems(mode, document, selectedItems, activeItems);
  const progress =
    durationMs > 0 ? Math.min(100, Math.max(0, (currentTimeMs / durationMs) * 100)) : 0;

  return (
    <div
      data-slot="timeline-workbench-preview"
      className="grid h-full min-w-0 overflow-hidden p-0"
      style={{ gridTemplateRows: "auto minmax(0, 1fr)" }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2">
        <div className="min-w-0">
          <div className="text-sm font-medium">Preview</div>
          <div className="text-xs tabular-nums text-muted-foreground">
            {formatTimelineEditorTimeMs(currentTimeMs)}
          </div>
        </div>
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <ToggleGroup
            type="single"
            value={mode}
            aria-label="Preview mode"
            onValueChange={(value) => {
              if (value) {
                onModeChange(value as TimelineWorkbenchPreviewMode);
              }
            }}
          >
            <ToggleGroupItem value="active-scene" size="sm" aria-label="Scene">
              Scene
            </ToggleGroupItem>
            <ToggleGroupItem value="selection-first" size="sm" aria-label="Selection">
              Selection
            </ToggleGroupItem>
            <ToggleGroupItem value="mini-timeline" size="sm" aria-label="Timeline">
              Timeline
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      <div className="relative min-h-0 overflow-hidden bg-zinc-950">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-zinc-800">
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        {mode === "mini-timeline" ? (
          <TimelineWorkbenchMiniPreview
            currentTimeMs={currentTimeMs}
            document={document}
            durationMs={durationMs}
          />
        ) : (
          <TimelineWorkbenchScenePreview
            currentTimeMs={currentTimeMs}
            document={document}
            durationMs={durationMs}
            extensions={extensions}
            items={previewItems}
            loopRange={loopRange}
            selectedItems={selectedItems}
            transport={transport}
          />
        )}
      </div>
    </div>
  );
}

function TimelineWorkbenchScenePreview<TTrackData extends Record<string, unknown>, TItemData>({
  currentTimeMs,
  document,
  durationMs,
  extensions,
  items,
  loopRange,
  selectedItems,
  transport,
}: {
  currentTimeMs: number;
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
  extensions: Array<TimelineEditorExtension<TItemData, TTrackData, unknown>>;
  items: Array<{
    item: TimelineEditorItem<TItemData>;
    track?: TimelineEditorTrack<TTrackData, TItemData>;
  }>;
  loopRange?: TimelineEditorTimeRange;
  selectedItems: Array<TimelineEditorItem<TItemData>>;
  transport: TimelinePreviewTransportContext;
}) {
  const mediaPreloads = getTimelineWorkbenchSceneMediaPreloads(
    document as TimelineEditorDocument<Record<string, unknown>, unknown>,
    currentTimeMs,
    loopRange,
  );
  const sceneItems = items.filter(({ item }) => isTimelineWorkbenchKnownSceneItem(item));
  const visualItems = sceneItems.filter(({ item }) => {
    const mediaType = getTimelineMediaTypeForItem(item as TimelineEditorItem<unknown>);

    return mediaType === "video" || mediaType === "image" || mediaType === "text";
  });
  const audioItems = sceneItems.filter(({ item }) => {
    const mediaType = getTimelineMediaTypeForItem(item as TimelineEditorItem<unknown>);

    return mediaType === "audio";
  });
  const unknownItems = items.filter(({ item }) => !isTimelineWorkbenchKnownSceneItem(item));
  const extension = getTimelineWorkbenchPreviewExtension(
    unknownItems.map(({ item }) => item),
    extensions,
  );
  const extensionPreview =
    unknownItems.length > 0
      ? extension?.renderPreview?.({
          currentTimeMs,
          document: document as TimelineEditorDocument<Record<string, unknown>, TItemData>,
          durationMs,
          items: unknownItems.map(({ item }) => item),
          selectedItems,
          transport,
        })
      : null;
  if (items.length === 0) {
    return (
      <>
        <TimelineWorkbenchSceneMediaPreloads preloads={mediaPreloads} />
        <div className="grid h-full place-items-center p-4">
          <div className="grid gap-1 text-center text-white">
            <div className="text-sm font-medium">0 active items</div>
            <div className="text-xs text-white/60">
              {formatTimelineEditorTimeMs(currentTimeMs)} / {formatTimelineEditorTimeMs(durationMs)}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (sceneItems.length === 0 && extensionPreview) {
    return (
      <>
        <TimelineWorkbenchSceneMediaPreloads preloads={mediaPreloads} />
        {extensionPreview}
      </>
    );
  }

  return (
    <div data-slot="timeline-workbench-scene-preview" className="relative h-full w-full text-white">
      <TimelineWorkbenchSceneMediaPreloads preloads={mediaPreloads} />
      {visualItems.map(({ item, track }, index) => (
        <TimelineWorkbenchSceneLayer
          key={item.id}
          currentTimeMs={currentTimeMs}
          item={item as TimelineEditorItem<unknown>}
          trackLabel={track?.label}
          transport={transport}
          zIndex={index + 1}
        />
      ))}
      {audioItems.map(({ item }) => (
        <TimelineWorkbenchSceneAudio
          key={item.id}
          currentTimeMs={currentTimeMs}
          item={item as TimelineEditorItem<unknown>}
          transport={transport}
        />
      ))}
      {visualItems.length === 0 && unknownItems.length === 0 ? (
        <div className="grid h-full place-items-center p-4">
          <div className="grid w-full max-w-md gap-2">
            {items.slice(0, 4).map(({ item, track }) => (
              <TimelineWorkbenchFallbackItemCard
                key={item.id}
                item={item}
                trackLabel={track?.label}
              />
            ))}
          </div>
        </div>
      ) : null}
      {unknownItems.length > 0 ? (
        <div className="absolute inset-x-4 bottom-4 z-50 grid max-h-40 gap-2 overflow-auto">
          {extensionPreview ?? (
            <>
              {unknownItems.slice(0, 4).map(({ item, track }) => (
                <TimelineWorkbenchFallbackItemCard
                  key={item.id}
                  item={item}
                  trackLabel={track?.label}
                />
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function TimelineWorkbenchSceneLayer({
  currentTimeMs,
  item,
  trackLabel,
  transport,
  zIndex,
}: {
  currentTimeMs: number;
  item: TimelineEditorItem<unknown>;
  trackLabel?: string;
  transport: TimelinePreviewTransportContext;
  zIndex: number;
}) {
  const mediaType = getTimelineMediaTypeForItem(item);
  const data = getTimelineWorkbenchItemData(item);

  if (mediaType === "video") {
    return (
      <TimelineWorkbenchSceneVideo
        currentTimeMs={currentTimeMs}
        item={item}
        transport={transport}
        zIndex={zIndex}
      />
    );
  }

  if (mediaType === "image") {
    const sourceUri = getTimelineWorkbenchSourceUri(data) ?? getStringField(data, "src");

    return sourceUri ? (
      <img
        alt={getStringField(data, "alt") ?? item.label}
        data-slot="timeline-workbench-scene-image"
        className="absolute inset-0 h-full w-full"
        src={sourceUri}
        style={{ objectFit: getTimelineWorkbenchObjectFit(data), zIndex }}
      />
    ) : (
      <TimelineWorkbenchSourceState item={item} label="No image source" zIndex={zIndex} />
    );
  }

  if (mediaType === "text") {
    const text = getTimelineTextDisplayText(
      data as Parameters<typeof getTimelineTextDisplayText>[0],
      item.label,
      currentTimeMs - item.startMs,
    );

    return (
      <div
        data-slot="timeline-workbench-scene-text"
        className="absolute inset-x-4 bottom-4 grid justify-items-center"
        style={{ zIndex }}
      >
        <div className="max-w-[80%] rounded bg-black/70 px-3 py-2 text-center text-sm shadow">
          {text}
        </div>
      </div>
    );
  }

  return <TimelineWorkbenchFallbackItemCard item={item} trackLabel={trackLabel} />;
}

function TimelineWorkbenchSceneVideo({
  currentTimeMs,
  item,
  transport,
  zIndex,
}: {
  currentTimeMs: number;
  item: TimelineEditorItem<unknown>;
  transport: TimelinePreviewTransportContext;
  zIndex: number;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const data = getTimelineWorkbenchItemData(item);
  const sourceUri = getTimelineWorkbenchSourceUri(data);
  const sync = useTimelineWorkbenchSynchronizedMediaElement({
    elementRef: videoRef,
    item,
    transport,
    currentTimeMs,
    sourceStartMs: getNumberField(data, "sourceStartMs"),
    sourceEndMs: getNumberField(data, "sourceEndMs"),
    muted: getBooleanField(data, "muted"),
    volume: getNumberField(data, "volume"),
  });

  if (!sourceUri) {
    return <TimelineWorkbenchSourceState item={item} label="No video source" zIndex={zIndex} />;
  }

  return (
    <>
      <video
        ref={videoRef}
        controls
        data-slot="timeline-workbench-scene-video"
        className="absolute inset-0 h-full w-full"
        muted={getBooleanField(data, "muted")}
        playsInline
        poster={getStringField(data, "poster")}
        preload="auto"
        src={sourceUri}
        style={{ objectFit: getTimelineWorkbenchObjectFit(data), zIndex }}
      />
      {sync.blocked ? (
        <div
          data-slot="timeline-media-playback-blocked"
          className="absolute right-3 top-3 rounded bg-black/70 px-2 py-1 text-xs"
          style={{ zIndex: zIndex + 1 }}
        >
          Media playback blocked
        </div>
      ) : null}
    </>
  );
}

function TimelineWorkbenchSceneAudio({
  currentTimeMs,
  item,
  transport,
}: {
  currentTimeMs: number;
  item: TimelineEditorItem<unknown>;
  transport: TimelinePreviewTransportContext;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const data = getTimelineWorkbenchItemData(item);
  const sourceUri = getTimelineWorkbenchSourceUri(data);
  const sync = useTimelineWorkbenchSynchronizedMediaElement({
    elementRef: audioRef,
    item,
    transport,
    currentTimeMs,
    sourceStartMs: getNumberField(data, "sourceStartMs"),
    sourceEndMs: getNumberField(data, "sourceEndMs"),
    muted: getBooleanField(data, "muted"),
    volume: getNumberField(data, "volume"),
  });

  if (!sourceUri) {
    return null;
  }

  return (
    <>
      <audio
        ref={audioRef}
        data-slot="timeline-workbench-scene-audio"
        muted={getBooleanField(data, "muted")}
        preload="auto"
        src={sourceUri}
      />
      {sync.blocked ? (
        <div
          data-slot="timeline-media-playback-blocked"
          className="absolute right-3 top-3 z-50 rounded bg-black/70 px-2 py-1 text-xs"
        >
          Media playback blocked
        </div>
      ) : null}
    </>
  );
}

type TimelineWorkbenchSceneMediaPreload = {
  key: string;
  mediaType: "audio" | "video";
  item: TimelineEditorItem<unknown>;
  muted?: boolean;
  poster?: string;
  sourceEndMs?: number;
  sourceStartMs?: number;
  src: string;
  targetTimeMs: number;
};

const mediaPreloadLookaheadMs = 2_000;
const mediaPreloadBeforeCursorMs = 250;
const maxTimelineWorkbenchSceneMediaPreloads = 24;

function TimelineWorkbenchSceneMediaPreloads({
  preloads,
}: {
  preloads: TimelineWorkbenchSceneMediaPreload[];
}) {
  return (
    <>
      {preloads.map((preload) => (
        <TimelineWorkbenchSceneMediaPreloadElement key={preload.key} preload={preload} />
      ))}
    </>
  );
}

function TimelineWorkbenchSceneMediaPreloadElement({
  preload,
}: {
  preload: TimelineWorkbenchSceneMediaPreload;
}) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const targetLocalTimeSeconds =
    getTimelineWorkbenchPreloadLocalTimeMs(preload.item, preload.targetTimeMs, {
      sourceEndMs: preload.sourceEndMs,
      sourceStartMs: preload.sourceStartMs ?? 0,
    }) / 1_000;

  useEffect(() => {
    const element = mediaRef.current;

    if (!element) {
      return;
    }

    const seekToTarget = () => {
      if (!Number.isFinite(targetLocalTimeSeconds)) {
        return;
      }

      try {
        if (Math.abs(element.currentTime - targetLocalTimeSeconds) > 0.05) {
          element.currentTime = targetLocalTimeSeconds;
        }
      } catch {
        // Some media sources cannot seek until enough metadata has loaded.
      }
    };

    if (element.readyState >= 1) {
      seekToTarget();
    }

    element.addEventListener("loadedmetadata", seekToTarget);
    element.addEventListener("canplay", seekToTarget);

    return () => {
      element.removeEventListener("loadedmetadata", seekToTarget);
      element.removeEventListener("canplay", seekToTarget);
    };
  }, [targetLocalTimeSeconds]);

  const sharedProps = {
    "aria-hidden": "true",
    "data-media-type": preload.mediaType,
    "data-slot": "timeline-workbench-scene-media-preload",
    muted: preload.muted ?? true,
    preload: "auto",
    src: preload.src,
    style: {
      height: 1,
      left: 0,
      opacity: 0,
      pointerEvents: "none",
      position: "absolute",
      top: 0,
      width: 1,
    },
    tabIndex: -1,
  } as const;

  if (preload.mediaType === "video") {
    return (
      <video
        ref={(element) => {
          mediaRef.current = element;
        }}
        {...sharedProps}
        playsInline
        poster={preload.poster}
      />
    );
  }

  return (
    <audio
      ref={(element) => {
        mediaRef.current = element;
      }}
      {...sharedProps}
    />
  );
}

function TimelineWorkbenchSourceState({
  item,
  label,
  zIndex,
}: {
  item: TimelineEditorItem<unknown>;
  label: string;
  zIndex: number;
}) {
  return (
    <div className="absolute inset-0 grid place-items-center p-4" style={{ zIndex }}>
      <div className="grid gap-1 text-center text-white">
        <div className="text-sm font-medium">{item.label}</div>
        <div className="text-xs text-white/60">{label}</div>
      </div>
    </div>
  );
}

function TimelineWorkbenchFallbackItemCard<TItemData>({
  item,
  trackLabel,
}: {
  item: TimelineEditorItem<TItemData>;
  trackLabel?: string;
}) {
  return (
    <div
      className="grid min-h-12 gap-1 rounded border border-white/10 bg-white/10 px-3 py-2 text-white shadow-sm"
      style={{
        borderLeftColor: item.color ?? "hsl(var(--primary))",
        borderLeftWidth: 4,
      }}
    >
      <div className="truncate text-sm font-medium">{item.label}</div>
      <div className="truncate text-xs text-white/60">{trackLabel ?? item.kind ?? item.id}</div>
    </div>
  );
}

function TimelineWorkbenchMiniPreview<TTrackData extends Record<string, unknown>, TItemData>({
  currentTimeMs,
  document,
  durationMs,
}: {
  currentTimeMs: number;
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const safeDurationMs = Math.max(1, durationMs);
  const timelineWidthPx = Math.max(480, (safeDurationMs / 1_000) * 64);
  const playheadLeftPx = Math.min(
    timelineWidthPx,
    Math.max(0, (currentTimeMs / safeDurationMs) * timelineWidthPx),
  );

  useLayoutEffect(() => {
    const scroller = scrollRef.current;

    if (!scroller) {
      return;
    }

    const marginPx = 48;
    const safeLeft = scroller.scrollLeft + marginPx;
    const safeRight = scroller.scrollLeft + scroller.clientWidth - marginPx;
    let nextScrollLeft = scroller.scrollLeft;

    if (playheadLeftPx < safeLeft) {
      nextScrollLeft = playheadLeftPx - marginPx;
    } else if (playheadLeftPx > safeRight) {
      nextScrollLeft = playheadLeftPx - scroller.clientWidth + marginPx;
    }

    nextScrollLeft = Math.max(
      0,
      Math.min(nextScrollLeft, Math.max(0, scroller.scrollWidth - scroller.clientWidth)),
    );

    if (Math.abs(scroller.scrollLeft - nextScrollLeft) >= 1) {
      scroller.scrollLeft = nextScrollLeft;
    }
  }, [playheadLeftPx]);

  if (document.tracks.length === 0) {
    return (
      <div
        data-slot="timeline-workbench-mini-preview"
        className="grid h-full place-items-center p-4 text-center text-white"
      >
        <div className="text-sm font-medium">
          0 tracks · {formatTimelineEditorTimeMs(currentTimeMs)} /{" "}
          {formatTimelineEditorTimeMs(durationMs)}
        </div>
      </div>
    );
  }

  return (
    <div
      data-slot="timeline-workbench-mini-preview"
      className="grid h-full min-h-0 text-white"
      style={{ gridTemplateColumns: "96px minmax(0, 1fr)" }}
    >
      <div className="overflow-hidden border-r border-white/10 pt-4">
        {document.tracks.map((track) => (
          <div
            key={track.id}
            data-slot="timeline-workbench-mini-preview-label"
            className="flex h-9 items-center truncate border-b border-white/10 px-3 text-xs text-white/70"
            title={track.label}
          >
            {track.label}
          </div>
        ))}
      </div>
      <div ref={scrollRef} className="min-w-0 overflow-x-auto overflow-y-hidden pt-4">
        <div className="relative" style={{ width: timelineWidthPx }}>
          <div
            data-slot="timeline-workbench-mini-preview-playhead"
            className="absolute top-0 bottom-0 z-20 w-px bg-primary"
            style={{ left: playheadLeftPx }}
          />
          {document.tracks.map((track) => (
            <div
              key={track.id}
              data-slot="timeline-workbench-mini-preview-row"
              className="relative h-9 border-b border-white/10"
            >
              {track.items.map((item) => (
                <div
                  key={item.id}
                  data-slot="timeline-workbench-mini-preview-item"
                  className="absolute top-2 h-4 rounded-sm border border-white/10"
                  title={item.label}
                  style={{
                    left: `${Math.max(0, (item.startMs / safeDurationMs) * timelineWidthPx)}px`,
                    width: `${Math.max(2, (item.durationMs / safeDurationMs) * timelineWidthPx)}px`,
                    background: item.color ?? "hsl(var(--primary))",
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getTimelineWorkbenchPreviewItems<TTrackData extends Record<string, unknown>, TItemData>(
  mode: TimelineWorkbenchPreviewMode,
  document: TimelineEditorDocument<TTrackData, TItemData>,
  selectedItems: Array<TimelineEditorItem<TItemData>>,
  activeItems: Array<{
    item: TimelineEditorItem<TItemData>;
    track: TimelineEditorTrack<TTrackData, TItemData>;
  }>,
) {
  if (mode === "selection-first" && selectedItems.length > 0) {
    return selectedItems.map((item) => ({
      item,
      track: document.tracks.find((track) => track.id === item.trackId),
    }));
  }

  return activeItems;
}

function getTimelineWorkbenchPreviewExtension<
  TItemData,
  TTrackData extends Record<string, unknown>,
  TAssetData,
>(
  items: Array<TimelineEditorItem<TItemData>>,
  extensions: Array<TimelineEditorExtension<TItemData, TTrackData, TAssetData>>,
) {
  const itemKindExtension = extensions.find(
    (extension) =>
      extension.renderPreview &&
      items.some((item) => (item.kind ? extension.itemKinds?.includes(item.kind) : false)),
  );

  if (itemKindExtension) {
    return itemKindExtension;
  }

  return extensions.find(
    (extension) =>
      extension.renderPreview &&
      items.some((item) => {
        const mediaType = getTimelineMediaTypeForItem(item);

        return mediaType ? extension.mediaTypes?.includes(mediaType) : false;
      }),
  );
}

function getTimelineWorkbenchSceneMediaPreloads(
  document: TimelineEditorDocument<Record<string, unknown>, unknown>,
  currentTimeMs: number,
  loopRange: TimelineEditorTimeRange | undefined,
): TimelineWorkbenchSceneMediaPreload[] {
  const ranges = [
    {
      id: "cursor",
      order: 0,
      startMs: Math.max(0, currentTimeMs - mediaPreloadBeforeCursorMs),
      endMs: Math.max(0, currentTimeMs + mediaPreloadLookaheadMs),
      targetTimeMs: Math.max(0, currentTimeMs),
    },
  ];

  if (loopRange && loopRange.endMs > loopRange.startMs) {
    ranges.push({
      id: "loop",
      order: 1,
      startMs: Math.max(0, loopRange.startMs),
      endMs: Math.max(0, Math.min(loopRange.endMs, loopRange.startMs + mediaPreloadLookaheadMs)),
      targetTimeMs: Math.max(0, loopRange.startMs),
    });
  }

  const seen = new Set<string>();
  const preloads: Array<
    TimelineWorkbenchSceneMediaPreload & { order: number; rangeOrder: number }
  > = [];
  let order = 0;

  for (const track of document.tracks) {
    for (const item of track.items) {
      const mediaType = getTimelineMediaTypeForItem(item as TimelineEditorItem<unknown>);

      if (mediaType !== "audio" && mediaType !== "video") {
        order += 1;
        continue;
      }

      const data = getTimelineWorkbenchItemData(item as TimelineEditorItem<unknown>);
      const src = getTimelineWorkbenchSourceUri(data);

      if (!src) {
        order += 1;
        continue;
      }

      const itemEndMs = getTimelineEditorItemEndMs(item);

      for (const range of ranges) {
        if (range.endMs < item.startMs || range.startMs > itemEndMs) {
          continue;
        }

        const key = `${range.id}:${item.id}`;

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        preloads.push({
          key,
          item: item as TimelineEditorItem<unknown>,
          mediaType,
          muted: true,
          order,
          poster: mediaType === "video" ? getStringField(data, "poster") : undefined,
          rangeOrder: range.order,
          sourceEndMs: getNumberField(data, "sourceEndMs"),
          sourceStartMs: getNumberField(data, "sourceStartMs"),
          src,
          targetTimeMs: Math.max(item.startMs, Math.min(itemEndMs, range.targetTimeMs)),
        });
      }

      order += 1;
    }
  }

  return preloads
    .sort((a, b) => {
      if (a.rangeOrder !== b.rangeOrder) {
        return a.rangeOrder - b.rangeOrder;
      }

      if (a.targetTimeMs !== b.targetTimeMs) {
        return a.targetTimeMs - b.targetTimeMs;
      }

      return a.order - b.order;
    })
    .slice(0, maxTimelineWorkbenchSceneMediaPreloads)
    .map(({ order: _order, rangeOrder: _rangeOrder, ...preload }) => preload);
}

function getTimelineWorkbenchPreloadLocalTimeMs(
  item: TimelineEditorItem<unknown>,
  currentTimeMs: number,
  options: { sourceStartMs: number; sourceEndMs?: number },
) {
  const unclampedLocalTimeMs = currentTimeMs - item.startMs + options.sourceStartMs;
  const lowerBoundMs = Math.max(0, options.sourceStartMs);
  const resolvedUpperBoundMs = options.sourceEndMs ?? lowerBoundMs + item.durationMs;
  const upperBoundMs = Math.max(lowerBoundMs, resolvedUpperBoundMs);

  return Math.max(lowerBoundMs, Math.min(upperBoundMs, unclampedLocalTimeMs));
}

function isTimelineWorkbenchKnownSceneItem(item: TimelineEditorItem<unknown>) {
  const mediaType = getTimelineMediaTypeForItem(item);

  return (
    mediaType === "audio" || mediaType === "video" || mediaType === "image" || mediaType === "text"
  );
}

function getTimelineWorkbenchItemData(item: TimelineEditorItem<unknown>) {
  return item.data && typeof item.data === "object"
    ? (item.data as Record<string, unknown>)
    : undefined;
}

function getTimelineWorkbenchSourceUri(data: Record<string, unknown> | undefined) {
  const source = data?.["source"];

  if (!source || typeof source !== "object" || !("uri" in source)) {
    return undefined;
  }

  return typeof source.uri === "string" ? source.uri : undefined;
}

function getTimelineWorkbenchObjectFit(data: Record<string, unknown> | undefined) {
  const fit = getStringField(data, "fit");

  return fit === "cover" || fit === "fill" || fit === "none" ? fit : "contain";
}

function getStringField(data: Record<string, unknown> | undefined, key: string) {
  const value = data?.[key];

  return typeof value === "string" ? value : undefined;
}

function getNumberField(data: Record<string, unknown> | undefined, key: string) {
  const value = data?.[key];

  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getBooleanField(data: Record<string, unknown> | undefined, key: string) {
  const value = data?.[key];

  return typeof value === "boolean" ? value : undefined;
}
