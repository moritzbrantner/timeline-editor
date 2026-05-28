"use client";

import {
  formatTimelineEditorTimeMs,
  getTimelineEditorItemEndMs,
  type TimelineEditorDocument,
  type TimelineEditorItem,
} from "../../core";
import { getTimelineMediaTypeForItem } from "../../media-types";
import type { TimelineEditorExtension } from "./types";

type TimelineWorkbenchPreviewProps<
  TTrackData extends Record<string, unknown>,
  TItemData,
  TAssetData,
> = {
  currentTimeMs: number;
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
  extensions?: Array<TimelineEditorExtension<TItemData, TTrackData, TAssetData>>;
  selectedItems: Array<TimelineEditorItem<TItemData>>;
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
  selectedItems,
}: TimelineWorkbenchPreviewProps<TTrackData, TItemData, TAssetData>) {
  const activeItems = document.tracks.flatMap((track) =>
    track.items
      .filter(
        (item) =>
          item.startMs <= currentTimeMs && getTimelineEditorItemEndMs(item) >= currentTimeMs,
      )
      .map((item) => ({ item, track })),
  );
  const previewItems =
    selectedItems.length > 0
      ? selectedItems.map((item) => ({
          item,
          track: document.tracks.find((track) => track.id === item.trackId),
        }))
      : activeItems;
  const progress =
    durationMs > 0 ? Math.min(100, Math.max(0, (currentTimeMs / durationMs) * 100)) : 0;
  const extensionPreview = getTimelineWorkbenchPreviewExtension(
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
      className="grid min-w-0 overflow-hidden p-0"
      style={{ gridTemplateRows: "auto minmax(0, 1fr)" }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2">
        <div className="text-sm font-medium">Preview</div>
        <div className="text-xs tabular-nums text-muted-foreground">
          {formatTimelineEditorTimeMs(currentTimeMs)}
        </div>
      </div>
      <div className="relative min-h-0 overflow-hidden bg-zinc-950">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-zinc-800">
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
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
      </div>
    </div>
  );
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
