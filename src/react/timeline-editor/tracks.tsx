"use client";

import { cn } from "@moritzbrantner/ui";

import { timelineEditorTrackHeaderWidthPx } from "./constants";
import { TimelineEditorContextActionMenu } from "./context-menu-items";
import { getRenderedTimelineEditorTrackRows, getTimelineEditorTrackRows } from "./layout";
import { useTimelineEditor } from "./provider";
import { TimelineEditorTrackRow } from "./track-row";
import type {
  TimelineEditorTrackGroupContextMenuContext,
  TimelineEditorTrackGroupRowProps,
  TimelineEditorTracksProps,
} from "./types";

export function TimelineEditorTracks<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>({ components }: TimelineEditorTracksProps<TTrackData, TItemData> = {}) {
  const editor = useTimelineEditor<TTrackData, TItemData>();
  const rows = getTimelineEditorTrackRows(editor.visibleTracks);
  const { renderedRows, shouldVirtualizeRows, totalHeightPx } = getRenderedTimelineEditorTrackRows(
    rows,
    editor.measuredViewport,
    editor.virtualization,
  );
  const TrackGroupRow = components?.TrackGroupRow ?? TimelineEditorTrackGroupRow;
  const TrackRow = components?.TrackRow ?? TimelineEditorTrackRow;

  return (
    <div
      data-slot="timeline-editor-tracks"
      data-virtualized={shouldVirtualizeRows ? "true" : undefined}
      className={shouldVirtualizeRows ? "relative" : undefined}
      style={shouldVirtualizeRows ? { height: totalHeightPx } : undefined}
    >
      {renderedRows.map((row) => {
        const rowStyle = shouldVirtualizeRows
          ? {
              position: "absolute" as const,
              top: row.topPx,
              left: 0,
              right: 0,
              height: row.heightPx,
            }
          : undefined;

        return row.entry.type === "group" ? (
          <TrackGroupRow
            key={`group-${row.entry.group.id}`}
            group={row.entry.group}
            row={row as never}
            style={rowStyle}
          />
        ) : (
          <div key={row.entry.track.id} style={rowStyle}>
            <TrackRow components={components} entry={row.entry} row={row} />
          </div>
        );
      })}
    </div>
  );
}

export function TimelineEditorTrackGroupRow({ group, style }: TimelineEditorTrackGroupRowProps) {
  const editor = useTimelineEditor();
  const locked = Boolean(group.locked);
  const toggleCollapsed = () => {
    if (editor.readOnly) {
      return;
    }

    editor.commitDocument({
      ...editor.document,
      groups: editor.document.groups?.map((entry) =>
        entry.id === group.id ? { ...entry, collapsed: !entry.collapsed } : entry,
      ),
    });
  };
  const trackGroupContextMenuItems = editor.getTrackGroupContextMenuItems
    ? editor.getTrackGroupContextMenuItems({
        document: editor.document,
        durationMs: editor.durationMs,
        group,
        locked,
        readOnly: editor.readOnly,
        selection: editor.selection,
        selectedItems: editor.selectedItems,
      } satisfies TimelineEditorTrackGroupContextMenuContext)
    : [];

  const trackGroupRow = (
    <div
      style={style}
      data-slot="timeline-editor-track-group"
      data-collapsed={group.collapsed ? "true" : undefined}
      className={cn(
        "flex h-9 items-center border-b border-border/70 bg-muted/60 text-xs font-medium text-muted-foreground",
        editor.renderTrackGroupHeader && "px-3",
      )}
    >
      {editor.renderTrackGroupHeader ? (
        editor.renderTrackGroupHeader({
          group,
          collapsed: Boolean(group.collapsed),
          locked,
        })
      ) : (
        <button
          type="button"
          aria-label={`${group.collapsed ? "Expand" : "Collapse"} ${group.label}`}
          aria-expanded={!group.collapsed}
          disabled={editor.readOnly}
          onClick={toggleCollapsed}
          className="sticky left-0 flex h-full min-w-0 items-center gap-2 border-r bg-muted px-3 text-left hover:bg-accent disabled:cursor-default disabled:hover:bg-muted"
          style={{ width: timelineEditorTrackHeaderWidthPx }}
        >
          <span aria-hidden="true" className="w-3 shrink-0 text-center">
            {group.collapsed ? "▸" : "▾"}
          </span>
          <span className="min-w-0 flex-1 truncate">{group.label}</span>
        </button>
      )}
    </div>
  );

  if (trackGroupContextMenuItems.length === 0) {
    return trackGroupRow;
  }

  return (
    <TimelineEditorContextActionMenu
      items={trackGroupContextMenuItems}
      contentProps={{ "data-slot": "timeline-editor-track-group-menu" }}
    >
      {trackGroupRow}
    </TimelineEditorContextActionMenu>
  );
}
