"use client";

import { useState } from "react";

import { ActionMenu, Button, type MenuActionItem } from "@moritzbrantner/ui";

import type {
  TimelineEditorDocument,
  TimelineEditorEditPolicy,
  TimelineEditorItemKind,
  TimelineEditorSelection,
  TimelineEditorSnapOptions,
  TimelineEditorTool,
  TimelineEditorViewport,
} from "../../core";
import { formatTimelineEditorTimeMs, snapTimelineEditorTime } from "../../core";
import {
  TimelineEditor,
  timelineEditorTrackHeaderWidthPx,
  type TimelineEditorItemContextMenuItems,
  type TimelineEditorFollowCurrentTime,
  type TimelineEditorHotkeys,
  type TimelineEditorItemRenderContext,
  type TimelineEditorTimelineContextMenuItems,
  type TimelineEditorTrackContextMenuItems,
  type TimelineEditorTrackGroupContextMenuItems,
  type TimelineEditorTrackGroupRenderContext,
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
import { defaultTimelineWorkbenchHotkeys } from "./hotkeys";
import { getVisibleTracks } from "../timeline-editor/selection";
import type { TimelineWorkbenchAsset } from "./types";

type TimelineWorkbenchCanvasProps<
  TTrackData extends Record<string, unknown>,
  TItemData,
  TAssetData,
> = {
  assets: Array<TimelineWorkbenchAsset<TAssetData>>;
  draggedAssetId?: string | null;
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
  followCurrentTime?: TimelineEditorFollowCurrentTime;
  renderTimelineItem?: (context: TimelineEditorItemRenderContext<TItemData>) => React.ReactNode;
  renderTrackGroupHeader?: (context: TimelineEditorTrackGroupRenderContext) => React.ReactNode;
  getItemContextMenuItems: TimelineEditorItemContextMenuItems<TTrackData, TItemData>;
  getTimelineContextMenuItems?: TimelineEditorTimelineContextMenuItems<TTrackData, TItemData>;
  getTrackGroupContextMenuItems: TimelineEditorTrackGroupContextMenuItems<TTrackData, TItemData>;
  getTrackContextMenuItems: TimelineEditorTrackContextMenuItems<TTrackData, TItemData>;
  trackGroupMenuItems: MenuActionItem[];
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
  draggedAssetId,
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
  followCurrentTime = "off",
  renderTimelineItem,
  renderTrackGroupHeader,
  getItemContextMenuItems,
  getTimelineContextMenuItems,
  getTrackGroupContextMenuItems,
  getTrackContextMenuItems,
  trackGroupMenuItems,
  trackKinds,
  formatTrackKind,
  onAddTrack,
  onCurrentTimeChange,
  onDocumentChange,
  onDropAsset,
  onSelectionChange,
  onViewportChange,
}: TimelineWorkbenchCanvasProps<TTrackData, TItemData, TAssetData>) {
  const [dropFeedback, setDropFeedback] = useState<{
    allowed: boolean;
    asset: TimelineWorkbenchAsset<TAssetData>;
    durationMs: number;
    scrollLeftPx: number;
    scrollTopPx: number;
    timeMs: number;
    trackId: string;
  } | null>(null);

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
    const assetId =
      event.dataTransfer.getData(timelineWorkbenchAssetDragDataType) || draggedAssetId;

    return assets.find((asset) => asset.id === assetId);
  };

  const updateAssetDropFeedback = (event: React.DragEvent<HTMLDivElement>) => {
    if (readOnly || !hasTimelineWorkbenchAssetDragData(event, draggedAssetId)) {
      return;
    }

    const asset = getDraggedAsset(event);
    const placement = getAssetDropPlacement(event);

    if (!asset || !placement) {
      setDropFeedback(null);
      return;
    }

    const allowed = canPlaceTimelineWorkbenchAssetOnTrack(asset, placement.track);
    const scrollLeftPx = event.currentTarget.scrollLeft;
    const scrollTopPx = event.currentTarget.scrollTop;
    event.preventDefault();
    event.dataTransfer.dropEffect = allowed ? "copy" : "none";
    setDropFeedback((currentFeedback) => {
      const nextFeedback = {
        allowed,
        asset,
        durationMs: asset.durationMs,
        scrollLeftPx,
        scrollTopPx,
        timeMs: placement.timeMs,
        trackId: placement.track.id,
      };

      return currentFeedback &&
        currentFeedback.allowed === nextFeedback.allowed &&
        currentFeedback.asset.id === nextFeedback.asset.id &&
        currentFeedback.durationMs === nextFeedback.durationMs &&
        currentFeedback.scrollLeftPx === nextFeedback.scrollLeftPx &&
        currentFeedback.scrollTopPx === nextFeedback.scrollTopPx &&
        currentFeedback.timeMs === nextFeedback.timeMs &&
        currentFeedback.trackId === nextFeedback.trackId
        ? currentFeedback
        : nextFeedback;
    });
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
    <div
      data-slot="timeline-workbench-canvas"
      className="grid h-full min-h-0 min-w-0 overflow-hidden"
      style={{
        gridTemplateRows: "minmax(0, 1fr) auto",
      }}
    >
      <div className="relative min-h-0 min-w-0">
        <TimelineEditor
          className="h-full min-h-0 w-full min-w-0"
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
          followCurrentTime={followCurrentTime}
          hotkeys={{ ...defaultTimelineWorkbenchHotkeys, ...hotkeys }}
          onCurrentTimeChange={onCurrentTimeChange}
          onDocumentChange={onDocumentChange}
          onSelectionChange={onSelectionChange}
          onViewportChange={onViewportChange}
          renderItem={renderTimelineItem}
          renderTrackGroupHeader={renderTrackGroupHeader}
          getItemContextMenuItems={getItemContextMenuItems}
          getTimelineContextMenuItems={getTimelineContextMenuItems}
          getTrackGroupContextMenuItems={getTrackGroupContextMenuItems}
          getTrackContextMenuItems={getTrackContextMenuItems}
          onDragEnter={updateAssetDropFeedback}
          onDragLeave={(event) => {
            const relatedTarget = event.relatedTarget;

            if (!(relatedTarget instanceof Node) || !event.currentTarget.contains(relatedTarget)) {
              setDropFeedback(null);
            }
          }}
          onDragOver={updateAssetDropFeedback}
          onDrop={(event) => {
            if (readOnly || !hasTimelineWorkbenchAssetDragData(event, draggedAssetId)) {
              return;
            }

            event.preventDefault();
            const asset = getDraggedAsset(event);
            const placement = getAssetDropPlacement(event);
            setDropFeedback(null);

            if (
              !asset ||
              !placement ||
              !canPlaceTimelineWorkbenchAssetOnTrack(asset, placement.track)
            ) {
              return;
            }

            onDropAsset(asset, { trackId: placement.track.id, timeMs: placement.timeMs });
          }}
        />
        {dropFeedback ? (
          <TimelineWorkbenchDropFeedback
            document={document}
            feedback={dropFeedback}
            pixelsPerSecond={resolvedViewport.pixelsPerSecond}
          />
        ) : null}
      </div>
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
        <ActionMenu
          label="Track groups"
          align="start"
          items={trackGroupMenuItems}
          contentProps={{ "data-slot": "timeline-workbench-track-groups-menu" }}
          trigger={
            <Button type="button" size="sm" variant="outline" disabled={readOnly}>
              Track Groups
            </Button>
          }
        />
      </div>
    </div>
  );
}

function hasTimelineWorkbenchAssetDragData(
  event: React.DragEvent<HTMLDivElement>,
  draggedAssetId?: string | null,
) {
  return (
    Boolean(draggedAssetId) ||
    Array.from(event.dataTransfer.types).includes(timelineWorkbenchAssetDragDataType)
  );
}

function TimelineWorkbenchDropFeedback<TTrackData, TItemData, TAssetData>({
  document,
  feedback,
  pixelsPerSecond,
}: {
  document: TimelineEditorDocument<TTrackData, TItemData>;
  feedback: {
    allowed: boolean;
    asset: TimelineWorkbenchAsset<TAssetData>;
    durationMs: number;
    scrollLeftPx: number;
    scrollTopPx: number;
    timeMs: number;
    trackId: string;
  };
  pixelsPerSecond: number;
}) {
  const topPx = getTimelineWorkbenchTrackTopPx(document, feedback.trackId);
  const leftPx =
    timelineEditorTrackHeaderWidthPx +
    (feedback.timeMs / 1_000) * pixelsPerSecond -
    feedback.scrollLeftPx;
  const widthPx = Math.max(24, (feedback.durationMs / 1_000) * pixelsPerSecond);

  return (
    <div
      data-slot="timeline-workbench-drop-feedback"
      data-allowed={feedback.allowed ? "true" : "false"}
      className="pointer-events-none absolute inset-0 z-30"
      aria-hidden="true"
    >
      <div
        data-slot="timeline-workbench-drop-line"
        className={`absolute bottom-0 top-9 border-l-2 ${
          feedback.allowed ? "border-primary" : "border-destructive"
        }`}
        style={{ left: leftPx }}
      >
        <span
          data-slot="timeline-workbench-drop-label"
          className={`absolute left-1 top-1 whitespace-nowrap rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium shadow-sm ${
            feedback.allowed ? "text-foreground" : "text-destructive"
          }`}
        >
          {feedback.allowed ? "Drop" : "Incompatible"} {feedback.asset.label} at{" "}
          {formatTimelineEditorTimeMs(feedback.timeMs)}
        </span>
      </div>
      <div
        data-slot="timeline-workbench-drop-ghost"
        className={`absolute rounded border ${
          feedback.allowed ? "border-primary bg-primary/15" : "border-destructive bg-destructive/10"
        }`}
        style={{
          left: leftPx,
          top: timelineEditorRulerHeightPx + topPx - feedback.scrollTopPx + 8,
          width: widthPx,
          height: Math.max(24, timelineEditorDefaultTrackHeightPx - 16),
        }}
      />
    </div>
  );
}

function getTimelineWorkbenchTrackTopPx<TTrackData, TItemData>(
  document: TimelineEditorDocument<TTrackData, TItemData>,
  trackId: string,
) {
  let topPx = 0;

  for (const entry of getVisibleTracks(document)) {
    if (entry.type === "group") {
      topPx += timelineEditorTrackGroupHeightPx;
      continue;
    }

    if (entry.track.id === trackId) {
      return topPx;
    }

    topPx += entry.track.height ?? timelineEditorDefaultTrackHeightPx;
  }

  return 0;
}
