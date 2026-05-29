"use client";

import { useLayoutEffect, useRef } from "react";

import { Button, ToggleGroup, ToggleGroupItem } from "@moritzbrantner/ui";

import {
  formatTimelineEditorTimeMs,
  getTimelineEditorItemEndMs,
  type TimelineEditorDocument,
  type TimelineEditorItem,
  type TimelineEditorTrack,
} from "../../core";
import { getTimelineMediaTypeForItem } from "../../media-types";
import type { TimelineEditorExtension, TimelineWorkbenchPreviewMode } from "./types";

type TimelineWorkbenchPreviewProps<
  TTrackData extends Record<string, unknown>,
  TItemData,
  TAssetData,
> = {
  currentTimeMs: number;
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
  extensions?: Array<TimelineEditorExtension<TItemData, TTrackData, TAssetData>>;
  isPlaying: boolean;
  mode: TimelineWorkbenchPreviewMode;
  readOnly: boolean;
  selectedItems: Array<TimelineEditorItem<TItemData>>;
  onModeChange: (mode: TimelineWorkbenchPreviewMode) => void;
  onPause: () => void;
  onPlay: () => void;
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
  isPlaying,
  mode,
  readOnly,
  selectedItems,
  onModeChange,
  onPause,
  onPlay,
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
  const extensionPreview =
    mode === "mini-timeline"
      ? null
      : getTimelineWorkbenchPreviewExtension(
          previewItems.map(({ item }) => item),
          extensions,
        )?.renderPreview?.({
          currentTimeMs,
          document: document as TimelineEditorDocument<Record<string, unknown>, TItemData>,
          durationMs,
          items: previewItems.map(({ item }) => item),
          selectedItems,
        });

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
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={readOnly || durationMs <= 0 || currentTimeMs >= durationMs}
            onClick={isPlaying ? onPause : onPlay}
          >
            {isPlaying ? "Pause" : "Play"}
          </Button>
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
          <div className="grid h-full place-items-center p-4">
            {extensionPreview ??
              (previewItems.length === 0 ? (
                <div className="grid gap-1 text-center text-white">
                  <div className="text-sm font-medium">0 active items</div>
                  <div className="text-xs text-white/60">
                    {formatTimelineEditorTimeMs(currentTimeMs)} /{" "}
                    {formatTimelineEditorTimeMs(durationMs)}
                  </div>
                </div>
              ) : (
                <div className="grid w-full max-w-md gap-2">
                  {previewItems.slice(0, 4).map(({ item, track }) => (
                    <div
                      key={item.id}
                      className="grid min-h-12 gap-1 rounded border border-white/10 bg-white/10 px-3 py-2 text-white shadow-sm"
                      style={{
                        borderLeftColor: item.color ?? "hsl(var(--primary))",
                        borderLeftWidth: 4,
                      }}
                    >
                      <div className="truncate text-sm font-medium">{item.label}</div>
                      <div className="truncate text-xs text-white/60">
                        {track?.label ?? item.kind ?? item.id}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        )}
      </div>
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
