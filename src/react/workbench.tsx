"use client";

import { type ReactNode, useMemo, useState } from "react";

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
  type AssetBrowserItem,
  type InspectorFieldValue,
} from "@moritzbrantner/ui/labs";

import {
  addTimelineEditorMarker,
  detectTimelineEditorOverlaps,
  duplicateTimelineEditorItems,
  findTimelineEditorItem,
  formatTimelineEditorTimeMs,
  getTimelineEditorDurationMs,
  getTimelineEditorItemEndMs,
  insertTimelineEditorItem,
  normalizeTimelineEditorTracks,
  removeTimelineEditorItems,
  splitTimelineEditorItems,
  type TimelineEditorDocument,
  type TimelineEditorItem,
  type TimelineEditorItemKind,
  type TimelineEditorSelection,
  type TimelineEditorTrack,
  type TimelineEditorViewport,
} from "../core";
import {
  createTimelineEditorHistory,
  redoTimelineEditorHistory,
  undoTimelineEditorHistory,
  type TimelineEditorHistory,
} from "../history";
import { formatShortcutLabel } from "../shortcut-label";
import { TimelineEditor } from "./timeline-editor";

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
  itemIds: string[];
  track?: TimelineEditorTrack<Record<string, unknown>, TData>;
};

export type TimelineWorkbenchInspectorContext<TData = Record<string, unknown>> = {
  document: TimelineEditorDocument<Record<string, unknown>, TData>;
  durationMs: number;
  readOnly: boolean;
  selection: TimelineEditorSelection;
  selectedItem?: TimelineEditorItem<TData>;
  selectedItems: Array<TimelineEditorItem<TData>>;
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
  selection?: TimelineEditorSelection;
  readOnly?: boolean;
  pixelsPerSecond?: number;
  snapMs?: number;
  assets?: Array<TimelineWorkbenchAsset<TAssetData>>;
  className?: string;
  onDocumentChange?: (document: TimelineEditorDocument<TTrackData, TItemData>) => void;
  onCurrentTimeChange?: (timeMs: number) => void;
  onSelectionChange?: (selection: TimelineEditorSelection) => void;
  onSelectedItemChange?: (selection: TimelineWorkbenchSelection<TItemData>) => void;
  onViewportChange?: (viewport: TimelineEditorViewport) => void;
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
  selection,
  readOnly = false,
  pixelsPerSecond = 80,
  snapMs = 100,
  assets = [],
  className,
  onDocumentChange,
  onCurrentTimeChange,
  onSelectionChange,
  onSelectedItemChange,
  onViewportChange,
  onAssetInsert,
  renderAsset,
  renderInspector,
  renderToolbarActions,
}: TimelineWorkbenchProps<TTrackData, TItemData, TAssetData>) {
  const [internalViewport, setInternalViewport] = useState<TimelineEditorViewport>({
    pixelsPerSecond,
  });
  const [history, setHistory] = useState<TimelineEditorHistory<TTrackData, TItemData>>(
    () => createTimelineEditorHistory() as TimelineEditorHistory<TTrackData, TItemData>,
  );
  const durationMs = document.durationMs ?? getTimelineEditorDurationMs(document.tracks, 30_000);
  const currentTimeMs = document.currentTimeMs ?? 0;
  const resolvedSelection = selection ?? {
    itemIds: selectedItemId ? [selectedItemId] : [],
    anchorItemId: selectedItemId ?? undefined,
  };
  const selectedItems = resolvedSelection.itemIds
    .map((itemId) => findTimelineEditorItem(document.tracks, itemId)?.item)
    .filter((item): item is TimelineEditorItem<TItemData> => Boolean(item));
  const selected = resolvedSelection.itemIds[0]
    ? findTimelineEditorItem(document.tracks, resolvedSelection.itemIds[0])
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

  const commitDocument = (nextDocument: TimelineEditorDocument<TTrackData, TItemData>) => {
    if (nextDocument !== document) {
      setHistory((currentHistory) => ({
        undoStack: [
          ...currentHistory.undoStack,
          {
            id: `workbench-${Date.now()}-${currentHistory.undoStack.length + 1}`,
            label: "Edit timeline",
            before: document,
            after: nextDocument,
            selectionBefore: resolvedSelection,
            selectionAfter: resolvedSelection,
          },
        ],
        redoStack: [],
      }));
    }

    onDocumentChange?.(nextDocument);
  };

  const commitTracks = (tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>) => {
    commitDocument({
      ...document,
      tracks,
    });
  };

  const commitSelection = (nextSelection: TimelineEditorSelection) => {
    onSelectionChange?.(nextSelection);
    const nextSelected = nextSelection.itemIds[0]
      ? findTimelineEditorItem(document.tracks, nextSelection.itemIds[0])
      : undefined;
    onSelectedItemChange?.({
      item: nextSelected?.item,
      itemId: nextSelection.itemIds[0],
      itemIds: nextSelection.itemIds,
      track: nextSelected?.track as TimelineTrackForSelection<TItemData>,
    });
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
    selection: resolvedSelection,
    selectedItem,
    selectedItems,
    selectedTrack: selectedTrack as TimelineEditorTrack<Record<string, unknown>, TItemData>,
    updateSelectedItem,
  } satisfies TimelineWorkbenchInspectorContext<TItemData>;

  const insertAsset = (asset: TimelineWorkbenchAsset<TAssetData>) => {
    const selectedTrackForPlacement =
      selectedTrack && !selectedTrack.locked ? selectedTrack : undefined;
    const targetTrack =
      selectedTrackForPlacement ??
      document.tracks.find(
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

    commitTracks(insertTimelineEditorItem(document.tracks, item, { durationMs, snapMs }));
    commitSelection({ itemIds: [item.id], anchorItemId: item.id });
  };

  const commitViewport = (nextViewport: TimelineEditorViewport) => {
    setInternalViewport(nextViewport);
    onViewportChange?.(nextViewport);
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
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={readOnly || history.undoStack.length === 0}
              onClick={() => {
                const undo = undoTimelineEditorHistory(history);
                setHistory(undo.history);
                if (undo.document) {
                  onDocumentChange?.(undo.document);
                  if (undo.selection) {
                    commitSelection(undo.selection);
                  }
                }
              }}
            >
              Undo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={readOnly || history.redoStack.length === 0}
              onClick={() => {
                const redo = redoTimelineEditorHistory(history);
                setHistory(redo.history);
                if (redo.document) {
                  onDocumentChange?.(redo.document);
                  if (redo.selection) {
                    commitSelection(redo.selection);
                  }
                }
              }}
            >
              Redo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={readOnly || resolvedSelection.itemIds.length === 0}
              onClick={() => {
                commitTracks(
                  splitTimelineEditorItems(
                    document.tracks,
                    resolvedSelection.itemIds,
                    currentTimeMs,
                  ),
                );
              }}
            >
              Split
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={readOnly || resolvedSelection.itemIds.length === 0}
              onClick={() => {
                commitTracks(
                  duplicateTimelineEditorItems(document.tracks, resolvedSelection.itemIds),
                );
              }}
            >
              Duplicate
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={readOnly || resolvedSelection.itemIds.length === 0}
              onClick={() => {
                commitTracks(removeTimelineEditorItems(document.tracks, resolvedSelection.itemIds));
                commitSelection({ itemIds: [] });
              }}
            >
              Delete
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={readOnly}
              onClick={() => {
                const marker = {
                  id: `marker-${Date.now()}`,
                  timeMs: currentTimeMs,
                  label: formatTimelineEditorTimeMs(currentTimeMs),
                };
                commitDocument(addTimelineEditorMarker(document, marker, { durationMs }));
              }}
            >
              Marker
            </Button>
            <Badge variant="outline">{document.tracks.length} tracks</Badge>
            {document.groups?.length ? (
              <Badge variant="outline">{document.groups.length} groups</Badge>
            ) : null}
            <Badge variant={overlaps.length > 0 ? "destructive" : "secondary"}>
              {overlaps.length} overlaps
            </Badge>
            <Badge variant="outline">{formatTimelineEditorTimeMs(durationMs)}</Badge>
            <span className="text-xs text-muted-foreground">
              Nudge {formatShortcutLabel(defaultTimelineWorkbenchHotkeys.nudgeRight)}
            </span>
          </div>
          <div className="flex min-w-52 items-center gap-3">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <Slider
              value={[internalViewport.pixelsPerSecond]}
              min={32}
              max={180}
              step={4}
              onValueChange={(value) => {
                commitViewport({
                  ...internalViewport,
                  pixelsPerSecond: value[0] ?? pixelsPerSecond,
                });
              }}
            />
          </div>
          {renderToolbarActions?.(inspectorContext)}
        </WorkbenchToolbar>
      }
    >
      <WorkbenchCanvas className="overflow-auto p-3">
        <TimelineEditor
          document={document}
          selection={resolvedSelection}
          viewport={internalViewport}
          snap={{
            enabled: snapMs > 0,
            thresholdPx: 8,
            targets: [
              { type: "interval", intervalMs: snapMs },
              { type: "marker" },
              { type: "item-edge" },
              { type: "playhead" },
            ],
          }}
          readOnly={readOnly}
          hotkeys={defaultTimelineWorkbenchHotkeys}
          onCurrentTimeChange={onCurrentTimeChange}
          onDocumentChange={commitDocument}
          onSelectionChange={commitSelection}
          onViewportChange={commitViewport}
        />
      </WorkbenchCanvas>
    </WorkbenchLayout>
  );
}

type TimelineTrackForSelection<TItemData> =
  | TimelineEditorTrack<Record<string, unknown>, TItemData>
  | undefined;

function DefaultTimelineInspector<TData>({
  context,
}: {
  context: TimelineWorkbenchInspectorContext<TData>;
}) {
  const item = context.selectedItem;

  if (context.selectedItems.length > 1) {
    return (
      <div className="grid gap-3 p-4 text-sm">
        <div className="font-medium">{context.selectedItems.length} timeline items</div>
        <div className="text-muted-foreground">
          Shared actions are available from the toolbar. Select one item to edit timing fields.
        </div>
      </div>
    );
  }

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
