"use client";

import { TimelineEditorContextActionMenu } from "./context-menu-items";
import { useTimelineEditor } from "./provider";
import type {
  TimelineEditorTrackContextMenuContext,
  TimelineEditorTrackHeaderProps,
} from "./types";

export function TimelineEditorTrackHeader<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>({ contextMenu = true, entry }: TimelineEditorTrackHeaderProps<TTrackData, TItemData>) {
  const editor = useTimelineEditor<TTrackData, TItemData>();
  const locked = Boolean(editor.readOnly || entry.locked);
  const trackContextMenuItems =
    contextMenu && editor.getTrackContextMenuItems
      ? editor.getTrackContextMenuItems({
          document: editor.document,
          durationMs: editor.durationMs,
          locked,
          readOnly: editor.readOnly,
          selection: editor.selection,
          selectedItems: editor.selectedItems,
          track: entry.track,
        } satisfies TimelineEditorTrackContextMenuContext<TTrackData, TItemData>)
      : [];
  const trackHeader = (
    <div
      data-slot="timeline-editor-track-header"
      className="flex items-center border-r bg-muted/20 px-3 text-sm font-medium"
    >
      {editor.renderTrackHeader ? (
        editor.renderTrackHeader({
          track: entry.track as never,
          locked: entry.locked,
          collapsed: false,
        })
      ) : (
        <span className="truncate">{entry.track.label}</span>
      )}
    </div>
  );

  if (trackContextMenuItems.length === 0) {
    return trackHeader;
  }

  return (
    <TimelineEditorContextActionMenu
      items={trackContextMenuItems}
      contentProps={{ "data-slot": "timeline-editor-track-menu" }}
    >
      {trackHeader}
    </TimelineEditorContextActionMenu>
  );
}
