"use client";

import { Button, WorkbenchCanvas } from "@moritzbrantner/ui";

import type {
  TimelineEditorDocument,
  TimelineEditorSelection,
  TimelineEditorViewport,
} from "../../core";
import {
  TimelineEditor,
  type TimelineEditorItemContextMenuItems,
  type TimelineEditorItemRenderContext,
  type TimelineEditorTrackContextMenuItems,
  type TimelineEditorVirtualizationOptions,
} from "../timeline-editor";
import { defaultTimelineWorkbenchHotkeys } from "./toolbar";

type TimelineWorkbenchCanvasProps<TTrackData extends Record<string, unknown>, TItemData> = {
  document: TimelineEditorDocument<TTrackData, TItemData>;
  frameRate?: number;
  readOnly: boolean;
  resolvedSelection: TimelineEditorSelection;
  resolvedSnapMs: number;
  resolvedViewport: TimelineEditorViewport;
  virtualization?: TimelineEditorVirtualizationOptions;
  renderTimelineItem?: (context: TimelineEditorItemRenderContext<TItemData>) => React.ReactNode;
  getItemContextMenuItems: TimelineEditorItemContextMenuItems<TTrackData, TItemData>;
  getTrackContextMenuItems: TimelineEditorTrackContextMenuItems<TTrackData, TItemData>;
  onAddTimeline: () => void;
  onCurrentTimeChange?: (timeMs: number) => void;
  onDocumentChange: (document: TimelineEditorDocument<TTrackData, TItemData>) => void;
  onSelectionChange: (selection: TimelineEditorSelection) => void;
  onViewportChange: (viewport: TimelineEditorViewport) => void;
};

export function TimelineWorkbenchCanvas<TTrackData extends Record<string, unknown>, TItemData>({
  document,
  frameRate,
  readOnly,
  resolvedSelection,
  resolvedSnapMs,
  resolvedViewport,
  virtualization,
  renderTimelineItem,
  getItemContextMenuItems,
  getTrackContextMenuItems,
  onAddTimeline,
  onCurrentTimeChange,
  onDocumentChange,
  onSelectionChange,
  onViewportChange,
}: TimelineWorkbenchCanvasProps<TTrackData, TItemData>) {
  return (
    <WorkbenchCanvas className="overflow-auto p-3">
      <TimelineEditor
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
        }}
        frameRate={frameRate}
        readOnly={readOnly}
        virtualization={virtualization}
        hotkeys={defaultTimelineWorkbenchHotkeys}
        onCurrentTimeChange={onCurrentTimeChange}
        onDocumentChange={onDocumentChange}
        onSelectionChange={onSelectionChange}
        onViewportChange={onViewportChange}
        renderItem={renderTimelineItem}
        getItemContextMenuItems={getItemContextMenuItems}
        getTrackContextMenuItems={getTrackContextMenuItems}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={readOnly}
          onClick={onAddTimeline}
        >
          Add Timeline
        </Button>
      </div>
    </WorkbenchCanvas>
  );
}
