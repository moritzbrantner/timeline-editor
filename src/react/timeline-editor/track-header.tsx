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
  const selected = Boolean(
    editor.selection.itemIds.length === 0 && editor.selection.trackIds?.includes(entry.track.id),
  );
  const selectTrack = () => {
    editor.commitSelection({
      itemIds: [],
      anchorItemId: undefined,
      trackIds: [entry.track.id],
      markerIds: undefined,
      range: undefined,
    });
  };
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
      data-selected={selected ? "true" : undefined}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      className="flex items-center border-r bg-muted/20 px-3 text-sm font-medium data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }

        event.stopPropagation();
        selectTrack();
      }}
      onClick={(event) => {
        if (event.button === 0) {
          selectTrack();
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        selectTrack();
      }}
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
