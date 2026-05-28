"use client";

import { useMemo, useState, type DragEvent, type MouseEvent, type ReactNode } from "react";

import { Badge, Button, Input, WorkbenchPanel, cn } from "@moritzbrantner/ui";

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
  tracks: Array<TimelineEditorTrack<Record<string, unknown>, unknown>>;
  selectedTrack?: TimelineEditorTrack<Record<string, unknown>, unknown>;
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
  tracks,
  selectedTrack,
  readOnly,
  renderAsset,
  onMinimize,
  onInsertAsset,
  onAssetDragEnd,
  onAssetDragStart,
}: TimelineWorkbenchAssetsPanelProps<TAssetData>) {
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [mediaTypeFilter, setMediaTypeFilter] = useState("");
  const [compatibleOnly, setCompatibleOnly] = useState(false);
  const filterOptions = useMemo(
    () => ({
      kinds: [...new Set(assets.map((asset) => asset.kind).filter(Boolean))].sort(),
      mediaTypes: [
        ...new Set(assets.map((asset) => getTimelineMediaTypeForAsset(asset)).filter(Boolean)),
      ].sort(),
    }),
    [assets],
  );
  const filteredAssets = assets.filter((asset) => {
    const mediaType = getTimelineMediaTypeForAsset(asset);
    const status = getTimelineWorkbenchAssetCompatibility(asset, tracks, selectedTrack);
    const queryText = [asset.label, asset.description, asset.kind, mediaType]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      (!query.trim() || queryText.includes(query.trim().toLowerCase())) &&
      (!kindFilter || asset.kind === kindFilter) &&
      (!mediaTypeFilter || mediaType === mediaTypeFilter) &&
      (!compatibleOnly ||
        (selectedTrack
          ? canPlaceTimelineWorkbenchAssetOnTrack(asset, selectedTrack)
          : status.compatible))
    );
  });
  const assetBrowserItems = getTimelineWorkbenchAssetBrowserItems(filteredAssets);
  const assetBrowserItemLookup = new Map(assetBrowserItems.map((item) => [item.id, item]));
  const clearFilters = () => {
    setQuery("");
    setKindFilter("");
    setMediaTypeFilter("");
    setCompatibleOnly(false);
  };

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
            <Input
              value={query}
              placeholder="Search assets"
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                data-slot="timeline-workbench-asset-kind-filter"
                className="h-8 rounded border bg-background px-2 text-xs"
                value={kindFilter}
                onChange={(event) => setKindFilter(event.currentTarget.value)}
              >
                <option value="">All kinds</option>
                {filterOptions.kinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
              <select
                data-slot="timeline-workbench-asset-media-filter"
                className="h-8 rounded border bg-background px-2 text-xs"
                value={mediaTypeFilter}
                onChange={(event) => setMediaTypeFilter(event.currentTarget.value)}
              >
                <option value="">All media</option>
                {filterOptions.mediaTypes.map((mediaType) => (
                  <option key={mediaType} value={mediaType}>
                    {mediaType}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              Compatible with selected track
              <input
                type="checkbox"
                checked={compatibleOnly}
                onChange={(event) => setCompatibleOnly(event.currentTarget.checked)}
              />
            </label>
            {filteredAssets.length === 0 ? (
              <div className="grid gap-2 rounded border border-border bg-background p-3 text-sm">
                <div className="text-muted-foreground">
                  0 of {assets.length} assets match filters
                </div>
                <Button type="button" size="sm" variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            ) : null}
            {filteredAssets.map((asset) => {
              const assetBrowserItem = assetBrowserItemLookup.get(asset.id);
              const compatibility = getTimelineWorkbenchAssetCompatibility(
                asset,
                tracks,
                selectedTrack,
              );
              const startAssetDrag = (event: DragEvent<HTMLElement>) => {
                event.dataTransfer.effectAllowed = "copy";
                event.dataTransfer.setData(timelineWorkbenchAssetDragDataType, asset.id);
                event.dataTransfer.setData("text/plain", asset.label);
                onAssetDragStart?.(asset);
              };
              const prepareAssetDrag = (event: MouseEvent<HTMLElement>) => {
                if (event.button === 0 && !readOnly && compatibility.compatible) {
                  onAssetDragStart?.(asset);
                }
              };

              return (
                <Button
                  key={asset.id}
                  type="button"
                  variant="ghost"
                  aria-label={asset.label}
                  className="h-auto justify-start border border-border bg-background px-3 py-2 text-left"
                  disabled={readOnly || !compatibility.compatible}
                  draggable={!readOnly && compatibility.compatible}
                  onClick={() => {
                    if (compatibility.compatible) {
                      onInsertAsset(asset);
                      onAssetDragEnd?.();
                    }
                  }}
                  onMouseDown={prepareAssetDrag}
                  onDragStart={startAssetDrag}
                  onDragStartCapture={startAssetDrag}
                  onDragEnd={onAssetDragEnd}
                >
                  <div className="pointer-events-none grid gap-1">
                    {renderAsset ? (
                      renderAsset(asset)
                    ) : (
                      <>
                        <span className="font-medium">{assetBrowserItem?.name ?? asset.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {assetBrowserItem?.description ?? asset.kind ?? "item"} ·{" "}
                          {formatTimelineEditorTimeMs(asset.durationMs)}
                        </span>
                      </>
                    )}
                    <span className="text-[10px] text-muted-foreground">{compatibility.label}</span>
                  </div>
                </Button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            0 assets · {tracks.length} timeline tracks
          </p>
        )}
      </div>
    </WorkbenchPanel>
  );
}

function getTimelineWorkbenchAssetCompatibility<TAssetData>(
  asset: TimelineWorkbenchAsset<TAssetData>,
  tracks: Array<TimelineEditorTrack<Record<string, unknown>, unknown>>,
  selectedTrack?: TimelineEditorTrack<Record<string, unknown>, unknown>,
) {
  const selectedTrackCompatible = selectedTrack
    ? canPlaceTimelineWorkbenchAssetOnTrack(asset, selectedTrack)
    : false;
  const compatibleTrack = tracks.find((track) =>
    canPlaceTimelineWorkbenchAssetOnTrack(asset, track),
  );

  if (selectedTrackCompatible) {
    return { compatible: true, label: "Fits selected track" };
  }

  if (compatibleTrack) {
    return { compatible: true, label: "Uses another compatible track" };
  }

  return { compatible: false, label: "No compatible track" };
}
