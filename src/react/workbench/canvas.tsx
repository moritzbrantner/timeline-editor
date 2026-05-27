"use client";

import { ActionMenu, Button, type MenuActionItem, WorkbenchCanvas } from "@moritzbrantner/ui";

import type {
  TimelineEditorDocument,
  TimelineEditorEditPolicy,
  TimelineEditorItemKind,
  TimelineEditorSelection,
  TimelineEditorSnapOptions,
  TimelineEditorTool,
  TimelineEditorViewport,
} from "../../core";
import { snapTimelineEditorTime } from "../../core";
import {
  TimelineEditor,
  timelineEditorTrackHeaderWidthPx,
  type TimelineEditorItemContextMenuItems,
  type TimelineEditorHotkeys,
  type TimelineEditorItemRenderContext,
  type TimelineEditorTrackContextMenuItems,
  type TimelineEditorVirtualizationOptions,
} from "../timeline-editor";
import {
  timelineEditorDefaultTrackHeightPx,
  timelineEditorRulerHeightPx,
  timelineEditorTrackGroupHeightPx,
} from "../timeline-editor/constants";
import {
  canPlaceTimelineWorkbenchAssetOnTrack,
  timelineWorkbenchAssetDragDataType,
} from "./assets";
import { defaultTimelineWorkbenchHotkeys } from "./toolbar";
import type { TimelineWorkbenchAsset } from "./types";

type TimelineWorkbenchCanvasProps<
  TTrackData extends Record<string, unknown>,
  TItemData,
  TAssetData,
> = {
  assets: Array<TimelineWorkbenchAsset<TAssetData>>;
  document: TimelineEditorDocument<TTrackData, TItemData>;
  editPolicy?: Partial<TimelineEditorEditPolicy>;
  frameRate?: number;
  hotkeys?: Partial<TimelineEditorHotkeys>;
  readOnly: boolean;
  tool?: TimelineEditorTool;
  minItemDurationMs?: number;
  resolvedSelection: TimelineEditorSelection;
  snap?: Partial<TimelineEditorSnapOptions>;
  resolvedSnapMs: number;
  resolvedViewport: TimelineEditorViewport;
  virtualization?: TimelineEditorVirtualizationOptions;
  renderTimelineItem?: (context: TimelineEditorItemRenderContext<TItemData>) => React.ReactNode;
  getItemContextMenuItems: TimelineEditorItemContextMenuItems<TTrackData, TItemData>;
  getTrackContextMenuItems: TimelineEditorTrackContextMenuItems<TTrackData, TItemData>;
  trackKinds: TimelineEditorItemKind[];
  formatTrackKind: (kind: TimelineEditorItemKind) => string;
  onAddTrack: (kind?: TimelineEditorItemKind) => void;
  onCurrentTimeChange?: (timeMs: number) => void;
  onDocumentChange: (document: TimelineEditorDocument<TTrackData, TItemData>) => void;
  onDropAsset: (
    asset: TimelineWorkbenchAsset<TAssetData>,
    placement: { trackId: string; timeMs: number },
  ) => void;
  onSelectionChange: (selection: TimelineEditorSelection) => void;
  onViewportChange: (viewport: TimelineEditorViewport) => void;
};

export function TimelineWorkbenchCanvas<
  TTrackData extends Record<string, unknown>,
  TItemData,
  TAssetData,
>({
  assets,
  document,
  editPolicy,
  frameRate,
  hotkeys,
  readOnly,
  tool,
  minItemDurationMs,
  resolvedSelection,
  snap,
  resolvedSnapMs,
  resolvedViewport,
  virtualization,
  renderTimelineItem,
  getItemContextMenuItems,
  getTrackContextMenuItems,
  trackKinds,
  formatTrackKind,
  onAddTrack,
  onCurrentTimeChange,
  onDocumentChange,
  onDropAsset,
  onSelectionChange,
  onViewportChange,
}: TimelineWorkbenchCanvasProps<TTrackData, TItemData, TAssetData>) {
  const timelineMinHeightPx =
    timelineEditorRulerHeightPx +
    document.tracks.reduce(
      (heightPx, track) => heightPx + (track.height ?? timelineEditorDefaultTrackHeightPx),
      0,
    ) +
    (document.groups?.length ?? 0) * timelineEditorTrackGroupHeightPx;

  const getAssetDropPlacement = (event: React.DragEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    const trackElement = target?.closest<HTMLElement>("[data-slot='timeline-editor-track']");
    const trackId = trackElement?.dataset["trackId"];
    const track = trackId ? document.tracks.find((candidate) => candidate.id === trackId) : null;

    if (!track) {
      return null;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const timelineOffsetPx =
      event.clientX -
      bounds.left +
      event.currentTarget.scrollLeft -
      timelineEditorTrackHeaderWidthPx;
    const rawTimeMs = Math.max(
      0,
      Math.min(
        document.durationMs ?? Number.POSITIVE_INFINITY,
        (timelineOffsetPx / Math.max(1, resolvedViewport.pixelsPerSecond)) * 1_000,
      ),
    );
    const timeMs = Math.max(
      0,
      Math.min(
        document.durationMs ?? Number.POSITIVE_INFINITY,
        snapTimelineEditorTime(rawTimeMs, resolvedSnapMs),
      ),
    );

    return { track, timeMs };
  };

  const getDraggedAsset = (event: React.DragEvent<HTMLDivElement>) => {
    const assetId = event.dataTransfer.getData(timelineWorkbenchAssetDragDataType);

    return assets.find((asset) => asset.id === assetId);
  };

  const addTrackMenuItems: MenuActionItem[] =
    trackKinds.length > 0
      ? trackKinds.map((kind) => ({
          id: `add-track-${kind}`,
          label: `${formatTrackKind(kind)} Track`,
          onSelect: () => onAddTrack(kind),
        }))
      : [
          {
            id: "add-track",
            label: "Track",
            onSelect: () => onAddTrack(),
          },
        ];

  return (
    <WorkbenchCanvas
      className="grid min-h-0 overflow-hidden p-3"
      style={{
        gridTemplateRows: "minmax(0, 1fr) auto",
        minHeight: timelineMinHeightPx + 84,
      }}
    >
      <TimelineEditor
        className="h-full min-h-0 w-full"
        document={document}
        selection={resolvedSelection}
        viewport={resolvedViewport}
        snap={{
          enabled: resolvedSnapMs > 0,
          thresholdPx: 8,
          targets: [
            { type: "interval", intervalMs: resolvedSnapMs },
            { type: "marker" },
            { type: "item-edge" },
            { type: "playhead" },
          ],
          ...snap,
        }}
        frameRate={frameRate}
        tool={tool}
        minItemDurationMs={minItemDurationMs}
        editPolicy={editPolicy}
        readOnly={readOnly}
        virtualization={virtualization}
        hotkeys={{ ...defaultTimelineWorkbenchHotkeys, ...hotkeys }}
        onCurrentTimeChange={onCurrentTimeChange}
        onDocumentChange={onDocumentChange}
        onSelectionChange={onSelectionChange}
        onViewportChange={onViewportChange}
        renderItem={renderTimelineItem}
        getItemContextMenuItems={getItemContextMenuItems}
        getTrackContextMenuItems={getTrackContextMenuItems}
        onDragOver={(event) => {
          if (readOnly || !event.dataTransfer.types.includes(timelineWorkbenchAssetDragDataType)) {
            return;
          }

          const placement = getAssetDropPlacement(event);

          if (!placement) {
            return;
          }

          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          if (readOnly || !event.dataTransfer.types.includes(timelineWorkbenchAssetDragDataType)) {
            return;
          }

          const asset = getDraggedAsset(event);
          const placement = getAssetDropPlacement(event);

          if (
            !asset ||
            !placement ||
            !canPlaceTimelineWorkbenchAssetOnTrack(asset, placement.track)
          ) {
            return;
          }

          event.preventDefault();
          onDropAsset(asset, { trackId: placement.track.id, timeMs: placement.timeMs });
        }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ActionMenu
          label="Add track"
          align="start"
          items={addTrackMenuItems}
          contentProps={{ "data-slot": "timeline-workbench-add-track-menu" }}
          trigger={
            <Button type="button" size="sm" variant="outline" disabled={readOnly}>
              Add Track
            </Button>
          }
        />
      </div>
    </WorkbenchCanvas>
  );
}
