"use client";

import type { ReactNode } from "react";

import { Badge, Button, WorkbenchPanel, cn } from "@moritzbrantner/ui";

import {
  formatTimelineEditorTimeMs,
  type TimelineEditorItem,
  type TimelineEditorTrack,
} from "../../core";
import {
  getTimelineMediaTypeForAsset,
  isTimelineMediaType,
  type TimelineMediaType,
} from "../../media-types";
import { createTimelineWorkbenchItemId } from "./ids";
import type { TimelineWorkbenchAsset } from "./types";

export const timelineWorkbenchAssetDragDataType = "application/x-timeline-workbench-asset-id";

export function canPlaceTimelineWorkbenchAssetOnTrack<TTrackData, TItemData, TAssetData>(
  asset: TimelineWorkbenchAsset<TAssetData>,
  track: TimelineEditorTrack<TTrackData, TItemData>,
) {
  if (track.locked) {
    return false;
  }

  if (track.kind) {
    return asset.kind === track.kind;
  }

  return !track.acceptsItemKinds || !asset.kind || track.acceptsItemKinds.includes(asset.kind);
}

export function getTimelineWorkbenchAssetBrowserItems<TAssetData>(
  assets: Array<TimelineWorkbenchAsset<TAssetData>>,
) {
  return assets.map((asset) => {
    const mediaType = getTimelineMediaTypeForAsset(asset);

    return {
      id: asset.id,
      name: asset.label,
      type: "file",
      description: asset.description ?? mediaType ?? asset.kind,
      metadata: {
        Duration: formatTimelineEditorTimeMs(asset.durationMs),
        Kind: asset.kind ?? "item",
        ...(mediaType ? { "Media Type": mediaType } : {}),
      },
    };
  });
}

export function createTimelineWorkbenchItemFromAsset<TItemData, TAssetData>(
  asset: TimelineWorkbenchAsset<TAssetData>,
  placement: { trackId: string; timeMs: number },
  options: {
    createItemId?: (asset: TimelineWorkbenchAsset<TAssetData>) => string;
  } = {},
): TimelineEditorItem<TItemData> {
  const mediaType = isTimelineMediaType(asset.mediaType) ? asset.mediaType : undefined;

  return {
    id: createTimelineWorkbenchItemId(asset, options.createItemId),
    trackId: placement.trackId,
    label: asset.label,
    startMs: placement.timeMs,
    durationMs: asset.durationMs,
    kind: asset.kind,
    color: asset.color,
    data: getTimelineWorkbenchAssetData<TItemData, TAssetData>(asset, mediaType),
  };
}

function getTimelineWorkbenchAssetData<TItemData, TAssetData>(
  asset: TimelineWorkbenchAsset<TAssetData>,
  mediaType?: TimelineMediaType,
): TItemData | undefined {
  if (asset.data !== undefined) {
    return asset.data as unknown as TItemData;
  }

  return mediaType ? ({ mediaType } as TItemData) : undefined;
}

type TimelineWorkbenchAssetsPanelProps<TAssetData> = {
  assets: Array<TimelineWorkbenchAsset<TAssetData>>;
  className?: string;
  readOnly: boolean;
  renderAsset?: (asset: TimelineWorkbenchAsset<TAssetData>) => ReactNode;
  onMinimize?: () => void;
  onInsertAsset: (asset: TimelineWorkbenchAsset<TAssetData>) => void;
  onAssetDragEnd?: () => void;
  onAssetDragStart?: (asset: TimelineWorkbenchAsset<TAssetData>) => void;
};

export function TimelineWorkbenchAssetsPanel<TAssetData>({
  assets,
  className,
  readOnly,
  renderAsset,
  onMinimize,
  onInsertAsset,
  onAssetDragEnd,
  onAssetDragStart,
}: TimelineWorkbenchAssetsPanelProps<TAssetData>) {
  const assetBrowserItems = getTimelineWorkbenchAssetBrowserItems(assets);
  const assetBrowserItemLookup = new Map(assetBrowserItems.map((item) => [item.id, item]));

  return (
    <WorkbenchPanel side="left" className={cn("min-w-64 p-0", className)}>
      <div className="grid gap-3 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">Assets</div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{assets.length}</Badge>
            {onMinimize ? (
              <Button type="button" size="sm" variant="ghost" onClick={onMinimize}>
                Minimize
              </Button>
            ) : null}
          </div>
        </div>
        {assets.length > 0 ? (
          <div className="grid gap-2">
            {assets.map((asset) => {
              const assetBrowserItem = assetBrowserItemLookup.get(asset.id);

              return (
                <Button
                  key={asset.id}
                  type="button"
                  variant="ghost"
                  className="h-auto justify-start border border-border bg-background px-3 py-2 text-left"
                  disabled={readOnly}
                  draggable={!readOnly}
                  onClick={() => onInsertAsset(asset)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "copy";
                    event.dataTransfer.setData(timelineWorkbenchAssetDragDataType, asset.id);
                    event.dataTransfer.setData("text/plain", asset.label);
                    onAssetDragStart?.(asset);
                  }}
                  onDragEnd={onAssetDragEnd}
                >
                  {renderAsset ? (
                    renderAsset(asset)
                  ) : (
                    <span className="grid gap-1">
                      <span className="font-medium">{assetBrowserItem?.name ?? asset.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {assetBrowserItem?.description ?? asset.kind ?? "item"} ·{" "}
                        {formatTimelineEditorTimeMs(asset.durationMs)}
                      </span>
                    </span>
                  )}
                </Button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No timeline assets</p>
        )}
      </div>
    </WorkbenchPanel>
  );
}
