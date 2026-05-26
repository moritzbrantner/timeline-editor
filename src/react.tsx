"use client";

import { type ReactNode, useMemo } from "react";

import { formatKeyboardShortcut } from "@moritzbrantner/keyboard";
import {
  Badge,
  Button,
  Slider,
  WorkbenchCanvas,
  WorkbenchLayout,
  WorkbenchPanel,
  WorkbenchToolbar,
  cn,
} from "@moritzbrantner/ui";
import {
  AssetBrowser,
  InspectorPanel,
  TimelineEditor,
  type AssetBrowserItem,
  type InspectorFieldValue,
} from "@moritzbrantner/ui/labs";

import {
  detectTimelineEditorOverlaps,
  findTimelineEditorItem,
  formatTimelineEditorTimeMs,
  fromUiTimelineEditorTracks,
  getTimelineEditorDurationMs,
  getTimelineEditorItemEndMs,
  normalizeTimelineEditorTracks,
  removeTimelineEditorItem,
  toUiTimelineEditorMarkers,
  toUiTimelineEditorTracks,
  type TimelineEditorDocument,
  type TimelineEditorItem,
  type TimelineEditorItemKind,
  type TimelineEditorTrack,
} from "./core";

export type TimelineWorkbenchAsset<TData = Record<string, unknown>> = {
  id: string;
  label: string;
  kind?: TimelineEditorItemKind;
  durationMs: number;
  color?: string;
  description?: string;
  data?: TData;
};

export type TimelineWorkbenchSelection<TData = Record<string, unknown>> = {
  item?: TimelineEditorItem<TData>;
  itemId?: string;
  track?: TimelineEditorTrack<Record<string, unknown>, TData>;
};

export type TimelineWorkbenchInspectorContext<TData = Record<string, unknown>> = {
  document: TimelineEditorDocument<Record<string, unknown>, TData>;
  durationMs: number;
  readOnly: boolean;
  selectedItem?: TimelineEditorItem<TData>;
  selectedTrack?: TimelineEditorTrack<Record<string, unknown>, TData>;
  updateSelectedItem: (patch: Partial<TimelineEditorItem<TData>>) => void;
};

export type TimelineWorkbenchProps<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TAssetData = Record<string, unknown>,
> = {
  document: TimelineEditorDocument<TTrackData, TItemData>;
  selectedItemId?: string | null;
  readOnly?: boolean;
  pixelsPerSecond?: number;
  snapMs?: number;
  assets?: Array<TimelineWorkbenchAsset<TAssetData>>;
  className?: string;
  onDocumentChange?: (document: TimelineEditorDocument<TTrackData, TItemData>) => void;
  onCurrentTimeChange?: (timeMs: number) => void;
  onSelectedItemChange?: (selection: TimelineWorkbenchSelection<TItemData>) => void;
  onAssetInsert?: (
    asset: TimelineWorkbenchAsset<TAssetData>,
    placement: { trackId: string; timeMs: number },
  ) => void;
  renderAsset?: (asset: TimelineWorkbenchAsset<TAssetData>) => ReactNode;
  renderInspector?: (context: TimelineWorkbenchInspectorContext<TItemData>) => ReactNode;
  renderToolbarActions?: (context: TimelineWorkbenchInspectorContext<TItemData>) => ReactNode;
};

export const defaultTimelineWorkbenchHotkeys = {
  delete: "Delete",
  nudgeLeft: "ArrowLeft",
  nudgeRight: "ArrowRight",
  selectAll: "Mod+A",
};

export function TimelineWorkbench<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TAssetData = Record<string, unknown>,
>({
  document,
  selectedItemId,
  readOnly = false,
  pixelsPerSecond = 80,
  snapMs = 100,
  assets = [],
  className,
  onDocumentChange,
  onCurrentTimeChange,
  onSelectedItemChange,
  onAssetInsert,
  renderAsset,
  renderInspector,
  renderToolbarActions,
}: TimelineWorkbenchProps<TTrackData, TItemData, TAssetData>) {
  const durationMs = document.durationMs ?? getTimelineEditorDurationMs(document.tracks, 30_000);
  const currentTimeMs = document.currentTimeMs ?? 0;
  const selected = selectedItemId
    ? findTimelineEditorItem(document.tracks, selectedItemId)
    : undefined;
  const selectedItem = selected?.item;
  const selectedTrack = selected?.track;
  const overlaps = useMemo(() => detectTimelineEditorOverlaps(document.tracks), [document.tracks]);
  const assetBrowserItems = useMemo(
    () =>
      assets.map(
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
      ),
    [assets],
  );

  const commitTracks = (tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>) => {
    onDocumentChange?.({
      ...document,
      tracks,
    });
  };

  const commitDocument = (nextDocument: TimelineEditorDocument<TTrackData, TItemData>) => {
    onDocumentChange?.(nextDocument);
  };

  const updateSelectedItem = (patch: Partial<TimelineEditorItem<TItemData>>) => {
    if (readOnly || !selectedItem) {
      return;
    }

    commitTracks(
      normalizeTimelineEditorTracks(
        document.tracks.map((track) =>
          track.id === selectedItem.trackId
            ? {
                ...track,
                items: track.items.map((item) =>
                  item.id === selectedItem.id ? { ...item, ...patch } : item,
                ),
              }
            : track,
        ),
        { durationMs },
      ),
    );
  };

  const inspectorContext = {
    document: document as TimelineEditorDocument<Record<string, unknown>, TItemData>,
    durationMs,
    readOnly,
    selectedItem,
    selectedTrack: selectedTrack as TimelineEditorTrack<Record<string, unknown>, TItemData>,
    updateSelectedItem,
  } satisfies TimelineWorkbenchInspectorContext<TItemData>;

  const insertAsset = (asset: TimelineWorkbenchAsset<TAssetData>) => {
    const targetTrack = document.tracks.find(
      (track) =>
        !track.locked &&
        (!track.acceptsItemKinds || !asset.kind || track.acceptsItemKinds.includes(asset.kind)),
    );

    if (!targetTrack || readOnly) {
      return;
    }

    onAssetInsert?.(asset, { trackId: targetTrack.id, timeMs: currentTimeMs });

    if (onAssetInsert) {
      return;
    }

    const item = {
      id: `${asset.id}-${Date.now()}`,
      trackId: targetTrack.id,
      label: asset.label,
      startMs: currentTimeMs,
      durationMs: asset.durationMs,
      kind: asset.kind,
      color: asset.color,
      data: asset.data as TItemData | undefined,
    };

    commitTracks(
      normalizeTimelineEditorTracks(
        document.tracks.map((track) =>
          track.id === targetTrack.id ? { ...track, items: [...track.items, item] } : track,
        ),
        { durationMs, snapMs },
      ),
    );
    onSelectedItemChange?.({
      item,
      itemId: item.id,
      track: targetTrack as TimelineEditorTrack<Record<string, unknown>, TItemData>,
    });
  };

  return (
    <WorkbenchLayout
      className={cn("min-h-[34rem] overflow-hidden border border-border bg-background", className)}
      leftPanel={
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
                    onClick={() => insertAsset(asset)}
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
                    insertAsset(asset);
                  }
                }}
              />
            )}
          </div>
        </WorkbenchPanel>
      }
      rightPanel={
        <WorkbenchPanel side="right" className="min-w-72">
          {renderInspector ? (
            renderInspector(inspectorContext)
          ) : (
            <DefaultTimelineInspector context={inspectorContext} />
          )}
        </WorkbenchPanel>
      }
      toolbar={
        <WorkbenchToolbar className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{document.tracks.length} tracks</Badge>
            <Badge variant={overlaps.length > 0 ? "destructive" : "secondary"}>
              {overlaps.length} overlaps
            </Badge>
            <Badge variant="outline">{formatTimelineEditorTimeMs(durationMs)}</Badge>
            <span className="text-xs text-muted-foreground">
              Nudge {formatKeyboardShortcut(defaultTimelineWorkbenchHotkeys.nudgeRight)}
            </span>
          </div>
          <div className="flex min-w-52 items-center gap-3">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <Slider value={[pixelsPerSecond]} min={32} max={180} step={4} disabled />
          </div>
          {renderToolbarActions?.(inspectorContext)}
        </WorkbenchToolbar>
      }
    >
      <WorkbenchCanvas className="overflow-auto p-3">
        <TimelineEditor
          tracks={toUiTimelineEditorTracks(document.tracks)}
          duration={durationMs / 1_000}
          currentTime={currentTimeMs / 1_000}
          selectedClipId={selectedItemId ?? null}
          markers={toUiTimelineEditorMarkers(document.markers)}
          pixelsPerSecond={pixelsPerSecond}
          snapInterval={snapMs / 1_000}
          readOnly={readOnly}
          hotkeys={{
            delete: defaultTimelineWorkbenchHotkeys.delete,
            nudgeLeft: defaultTimelineWorkbenchHotkeys.nudgeLeft,
            nudgeRight: defaultTimelineWorkbenchHotkeys.nudgeRight,
            selectAll: defaultTimelineWorkbenchHotkeys.selectAll,
          }}
          onCurrentTimeChange={(time) => {
            const timeMs = Math.round(time * 1_000);
            onCurrentTimeChange?.(timeMs);
            commitDocument({ ...document, currentTimeMs: timeMs });
          }}
          onTracksChange={(uiTracks) => {
            if (readOnly) {
              return;
            }

            commitTracks(fromUiTimelineEditorTracks(uiTracks, document.tracks));
          }}
          onSelectedClipChange={(itemId, item) => {
            const nextSelected = itemId
              ? findTimelineEditorItem(document.tracks, itemId)
              : undefined;
            onSelectedItemChange?.({
              item: nextSelected?.item ?? (item as TimelineEditorItem<TItemData> | undefined),
              itemId: itemId ?? undefined,
              track: nextSelected?.track as
                | TimelineEditorTrack<Record<string, unknown>, TItemData>
                | undefined,
            });
          }}
          onClipDelete={(itemId) => {
            if (!readOnly) {
              commitTracks(removeTimelineEditorItem(document.tracks, itemId));
            }
          }}
        />
      </WorkbenchCanvas>
    </WorkbenchLayout>
  );
}

function DefaultTimelineInspector<TData>({
  context,
}: {
  context: TimelineWorkbenchInspectorContext<TData>;
}) {
  const item = context.selectedItem;

  if (!item) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Select a timeline item to inspect its timing and metadata.
      </div>
    );
  }

  return (
    <InspectorPanel
      title="Timeline item"
      description={context.selectedTrack?.label}
      readOnly={context.readOnly}
      values={{
        label: item.label,
        startMs: item.startMs,
        durationMs: item.durationMs,
        endMs: getTimelineEditorItemEndMs(item),
        kind: item.kind ?? "",
        locked: item.locked ?? false,
      }}
      sections={[
        {
          id: "timing",
          title: "Timing",
          fields: [
            { id: "label", label: "Label", type: "text" },
            { id: "startMs", label: "Start", type: "number", min: 0, step: 100 },
            { id: "durationMs", label: "Duration", type: "number", min: 100, step: 100 },
            { id: "endMs", label: "End", type: "number", readOnly: true },
            { id: "kind", label: "Kind", type: "text" },
            { id: "locked", label: "Locked", type: "boolean" },
          ],
        },
      ]}
      onApply={(values) => {
        context.updateSelectedItem({
          label: String(values.label ?? item.label),
          startMs: toNumber(values.startMs, item.startMs),
          durationMs: toNumber(values.durationMs, item.durationMs),
          kind: String(values.kind ?? "") || undefined,
          locked: Boolean(values.locked),
        });
      }}
    />
  );
}

function toNumber(value: InspectorFieldValue, fallback: number) {
  const nextValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}
