"use client";

import type { ReactNode } from "react";

import { Badge, Button, Slider, WorkbenchToolbar } from "@moritzbrantner/ui";

import type {
  TimelineEditorDocument,
  TimelineEditorSelection,
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
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
  hasSelectedItemGroup: boolean;
  history: TimelineEditorHistory<TTrackData, TItemData>;
  inspectorContext: TimelineWorkbenchInspectorContext<TItemData>;
  overlaps: TimelineEditorOverlap[];
  pixelsPerSecond: number;
  readOnly: boolean;
  resolvedSelection: TimelineEditorSelection;
  resolvedViewport: TimelineEditorViewport;
  renderToolbarActions?: (context: TimelineWorkbenchInspectorContext<TItemData>) => ReactNode;
  onAddMarker: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onGroup: () => void;
  onRedo: () => void;
  onSplit: () => void;
  onUngroup: () => void;
  onUndo: () => void;
  onViewportChange: (viewport: TimelineEditorViewport) => void;
};

export const defaultTimelineWorkbenchHotkeys = {
  delete: "Delete",
  nudgeLeft: "ArrowLeft",
  nudgeRight: "ArrowRight",
  selectAll: "Mod+A",
};

export function TimelineWorkbenchToolbar<TTrackData, TItemData>({
  document,
  durationMs,
  hasSelectedItemGroup,
  history,
  inspectorContext,
  overlaps,
  pixelsPerSecond,
  readOnly,
  resolvedSelection,
  resolvedViewport,
  renderToolbarActions,
  onAddMarker,
  onDelete,
  onDuplicate,
  onGroup,
  onRedo,
  onSplit,
  onUngroup,
  onUndo,
  onViewportChange,
}: TimelineWorkbenchToolbarProps<TTrackData, TItemData>) {
  return (
    <WorkbenchToolbar className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
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
      <div className="flex min-w-52 items-center gap-3">
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
