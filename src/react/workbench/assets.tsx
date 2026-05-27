"use client";

import type { ReactNode } from "react";

import { Badge, Button, WorkbenchPanel } from "@moritzbrantner/ui";
import { AssetBrowser, type AssetBrowserItem } from "@moritzbrantner/ui/labs";

import { formatTimelineEditorTimeMs, type TimelineEditorTrack } from "../../core";
import type { TimelineWorkbenchAsset } from "./types";

export function canPlaceTimelineWorkbenchAssetOnTrack<TTrackData, TItemData, TAssetData>(
  asset: TimelineWorkbenchAsset<TAssetData>,
  track: TimelineEditorTrack<TTrackData, TItemData>,
) {
  return (
    !track.locked &&
    (!track.acceptsItemKinds || !asset.kind || track.acceptsItemKinds.includes(asset.kind))
  );
}

export function getTimelineWorkbenchAssetBrowserItems<TAssetData>(
  assets: Array<TimelineWorkbenchAsset<TAssetData>>,
) {
  return assets.map(
    (asset): AssetBrowserItem => ({
      id: asset.id,
      name: asset.label,
      type: "file",
      description: asset.description ?? asset.kind,
      metadata: {
        Duration: formatTimelineEditorTimeMs(asset.durationMs),
        Kind: asset.kind ?? "item",
      },
    }),
  );
}

type TimelineWorkbenchAssetsPanelProps<TAssetData> = {
  assets: Array<TimelineWorkbenchAsset<TAssetData>>;
  readOnly: boolean;
  renderAsset?: (asset: TimelineWorkbenchAsset<TAssetData>) => ReactNode;
  onInsertAsset: (asset: TimelineWorkbenchAsset<TAssetData>) => void;
};

export function TimelineWorkbenchAssetsPanel<TAssetData>({
  assets,
  readOnly,
  renderAsset,
  onInsertAsset,
}: TimelineWorkbenchAssetsPanelProps<TAssetData>) {
  const assetBrowserItems = getTimelineWorkbenchAssetBrowserItems(assets);

  return (
    <WorkbenchPanel side="left" className="min-w-64">
      <div className="grid gap-3 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">Assets</div>
          <Badge variant="secondary">{assets.length}</Badge>
        </div>
        {renderAsset ? (
          <div className="grid gap-2">
            {assets.map((asset) => (
              <Button
                key={asset.id}
                type="button"
                variant="ghost"
                className="h-auto justify-start border border-border bg-background px-3 py-2 text-left"
                disabled={readOnly}
                onClick={() => onInsertAsset(asset)}
              >
                {renderAsset(asset)}
              </Button>
            ))}
          </div>
        ) : (
          <AssetBrowser
            items={assetBrowserItems}
            selectionMode="single"
            showPreview={false}
            emptyMessage="No timeline assets"
            onOpenItem={(item) => {
              const asset = assets.find((candidate) => candidate.id === item.id);

              if (asset) {
                onInsertAsset(asset);
              }
            }}
          />
        )}
      </div>
    </WorkbenchPanel>
  );
}
