"use client";

import { WorkbenchPanel } from "@moritzbrantner/ui";

import {
  formatTimelineEditorTimeMs,
  getTimelineEditorItemEndMs,
  type TimelineEditorDocument,
  type TimelineEditorItem,
} from "../../core";

type TimelineWorkbenchPreviewProps<TTrackData, TItemData> = {
  currentTimeMs: number;
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
  selectedItems: Array<TimelineEditorItem<TItemData>>;
};

export function TimelineWorkbenchPreview<TTrackData, TItemData>({
  currentTimeMs,
  document,
  durationMs,
  selectedItems,
}: TimelineWorkbenchPreviewProps<TTrackData, TItemData>) {
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

  return (
    <WorkbenchPanel
      side="bottom"
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
          <div className="grid w-full max-w-md gap-2">
            {previewItems.slice(0, 4).map(({ item, track }) => (
              <div
                key={item.id}
                className="grid min-h-12 gap-1 rounded border border-white/10 bg-white/10 px-3 py-2 text-white shadow-sm"
                style={{ borderLeftColor: item.color ?? "hsl(var(--primary))", borderLeftWidth: 4 }}
              >
                <div className="truncate text-sm font-medium">{item.label}</div>
                <div className="truncate text-xs text-white/60">
                  {track?.label ?? item.kind ?? item.id}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </WorkbenchPanel>
  );
}
