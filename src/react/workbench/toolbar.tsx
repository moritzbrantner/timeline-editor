"use client";

import type { ReactNode } from "react";

import { Badge, Button, Slider, WorkbenchToolbar } from "@moritzbrantner/ui";

import type {
  TimelineEditorClipboard,
  TimelineEditorDocument,
  TimelineEditorSelection,
  TimelineEditorTool,
  TimelineEditorViewport,
  TimelineEditorOverlap,
} from "../../core";
import { formatTimelineEditorTimeMs } from "../../core";
import type { TimelineEditorHistory } from "../../history";
import { formatShortcutLabel } from "../../shortcut-label";
import {
  timelineEditorMaxPixelsPerSecond,
  timelineEditorMinPixelsPerSecond,
} from "../timeline-editor";
import type { TimelineWorkbenchInspectorContext } from "./types";

type TimelineWorkbenchToolbarProps<TTrackData, TItemData> = {
  clipboard?: TimelineEditorClipboard<TItemData>;
  currentTimeMs: number;
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
  frameStepMs: number;
  hasSelectedItemGroup: boolean;
  history: TimelineEditorHistory<TTrackData, TItemData>;
  inspectorContext: TimelineWorkbenchInspectorContext<TItemData>;
  overlaps: TimelineEditorOverlap[];
  pixelsPerSecond: number;
  readOnly: boolean;
  resolvedSelection: TimelineEditorSelection;
  resolvedTool: TimelineEditorTool;
  resolvedViewport: TimelineEditorViewport;
  renderToolbarActions?: (context: TimelineWorkbenchInspectorContext<TItemData>) => ReactNode;
  onAddMarker: () => void;
  onCopy: () => void;
  onCut: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onGroup: () => void;
  onRedo: () => void;
  onPaste: () => void;
  onSplit: () => void;
  onStepFrame: (direction: -1 | 1) => void;
  onUngroup: () => void;
  onUndo: () => void;
  onViewportChange: (viewport: TimelineEditorViewport) => void;
  onToolChange: (tool: TimelineEditorTool) => void;
};

export const defaultTimelineWorkbenchHotkeys = {
  delete: "Delete",
  nudgeLeft: "ArrowLeft",
  nudgeRight: "ArrowRight",
  selectAll: "Mod+A",
  clearSelection: "Escape",
  copy: "Mod+C",
  cut: "Mod+X",
  paste: "Mod+V",
  undo: "Mod+Z",
  redo: "Shift+Mod+Z",
  redoAlternate: "Mod+Y",
  jumpStart: "Home",
  jumpEnd: "End",
  previousMarker: "Alt+ArrowLeft",
  nextMarker: "Alt+ArrowRight",
  previousEdge: "Shift+ArrowLeft",
  nextEdge: "Shift+ArrowRight",
};

export function TimelineWorkbenchToolbar<TTrackData, TItemData>({
  clipboard,
  currentTimeMs,
  document,
  durationMs,
  frameStepMs,
  hasSelectedItemGroup,
  history,
  inspectorContext,
  overlaps,
  pixelsPerSecond,
  readOnly,
  resolvedSelection,
  resolvedTool,
  resolvedViewport,
  renderToolbarActions,
  onAddMarker,
  onCopy,
  onCut,
  onDelete,
  onDuplicate,
  onGroup,
  onRedo,
  onPaste,
  onSplit,
  onStepFrame,
  onUngroup,
  onUndo,
  onViewportChange,
  onToolChange,
}: TimelineWorkbenchToolbarProps<TTrackData, TItemData>) {
  return (
    <WorkbenchToolbar className="min-h-9 justify-between gap-2 border-b border-border px-2 py-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={readOnly || history.undoStack.length === 0}
          onClick={onUndo}
        >
          Undo
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={readOnly || history.redoStack.length === 0}
          onClick={onRedo}
        >
          Redo
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={resolvedSelection.itemIds.length === 0}
          onClick={onCopy}
        >
          Copy
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={readOnly || resolvedSelection.itemIds.length === 0}
          onClick={onCut}
        >
          Cut
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={readOnly || !clipboard || clipboard.items.length === 0}
          onClick={onPaste}
        >
          Paste
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={readOnly || resolvedSelection.itemIds.length === 0}
          onClick={onSplit}
        >
          Split
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={readOnly || resolvedSelection.itemIds.length === 0}
          onClick={onDuplicate}
        >
          Duplicate
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={readOnly || resolvedSelection.itemIds.length < 2}
          onClick={onGroup}
        >
          Group
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={readOnly || !hasSelectedItemGroup}
          onClick={onUngroup}
        >
          Ungroup
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={readOnly || resolvedSelection.itemIds.length === 0}
          onClick={onDelete}
        >
          Delete
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={readOnly} onClick={onAddMarker}>
          Marker
        </Button>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          Tool
          <select
            className="h-7 rounded border bg-background px-2 text-xs"
            value={resolvedTool}
            disabled={readOnly}
            onChange={(event) => onToolChange(event.currentTarget.value as TimelineEditorTool)}
          >
            <option value="select">Select</option>
            <option value="blade">Blade</option>
            <option value="trim">Trim</option>
            <option value="ripple-trim">Ripple Trim</option>
            <option value="pan">Pan</option>
          </select>
        </label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label="Previous frame"
          title={`Previous frame (${formatTimelineWorkbenchFrameStep(frameStepMs)})`}
          disabled={readOnly || frameStepMs <= 0 || currentTimeMs <= 0}
          onClick={() => onStepFrame(-1)}
        >
          &lt;
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label="Next frame"
          title={`Next frame (${formatTimelineWorkbenchFrameStep(frameStepMs)})`}
          disabled={readOnly || frameStepMs <= 0 || currentTimeMs >= durationMs}
          onClick={() => onStepFrame(1)}
        >
          &gt;
        </Button>
        <Badge variant="outline">{document.tracks.length} tracks</Badge>
        {document.groups?.length ? (
          <Badge variant="outline">{document.groups.length} groups</Badge>
        ) : null}
        {document.itemGroups?.length ? (
          <Badge variant="outline">{document.itemGroups.length} item groups</Badge>
        ) : null}
        <Badge variant={overlaps.length > 0 ? "destructive" : "secondary"}>
          {overlaps.length} overlaps
        </Badge>
        <Badge variant="outline">{formatTimelineEditorTimeMs(durationMs)}</Badge>
        <span className="text-xs text-muted-foreground">
          Nudge {formatShortcutLabel(defaultTimelineWorkbenchHotkeys.nudgeRight)}
        </span>
      </div>
      <div className="flex min-w-44 items-center gap-2">
        <span className="text-xs text-muted-foreground">Zoom</span>
        <Slider
          value={[resolvedViewport.pixelsPerSecond]}
          min={timelineEditorMinPixelsPerSecond}
          max={timelineEditorMaxPixelsPerSecond}
          step={4}
          onValueChange={(value) => {
            onViewportChange({
              ...resolvedViewport,
              pixelsPerSecond: value[0] ?? pixelsPerSecond,
            });
          }}
        />
      </div>
      {renderToolbarActions?.(inspectorContext)}
    </WorkbenchToolbar>
  );
}

function formatTimelineWorkbenchFrameStep(frameStepMs: number) {
  if (frameStepMs < 1_000) {
    return `${Math.round(frameStepMs * 100) / 100} ms`;
  }

  return formatTimelineEditorTimeMs(frameStepMs);
}
