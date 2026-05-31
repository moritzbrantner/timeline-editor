"use client";

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
      className={shouldVirtualizeRows ? "relative" : "divide-y"}
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
      className="flex h-9 items-center border-b bg-muted/50 px-3 text-xs font-medium text-muted-foreground"
    >
      {editor.renderTrackGroupHeader
        ? editor.renderTrackGroupHeader({
            group,
            collapsed: Boolean(group.collapsed),
            locked,
          })
        : group.label}
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
