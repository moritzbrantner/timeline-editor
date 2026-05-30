"use client";

import { timelineEditorDefaultTrackHeightPx, timelineEditorTrackHeaderWidthPx } from "./constants";
import { TimelineEditorTrackHeader } from "./track-header";
import { TimelineEditorTrackLane } from "./track-lane";
import type { TimelineEditorTrackContextMenuContext, TimelineEditorTrackRowProps } from "./types";
import { useTimelineEditor } from "./provider";
import { isTimelineEditorPrimaryPointerButton } from "./pointer";
import { TimelineEditorContextActionMenu } from "./context-menu-items";

export function TimelineEditorTrackRow<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>({ components, entry, style }: TimelineEditorTrackRowProps<TTrackData, TItemData>) {
  const editor = useTimelineEditor<TTrackData, TItemData>();
  const Header = components?.TrackHeader ?? TimelineEditorTrackHeader;
  const Lane = components?.TrackLane ?? TimelineEditorTrackLane;
  const locked = Boolean(editor.readOnly || entry.locked);
  const trackContextMenuItems =
    !editor.getTimelineContextMenuItems && editor.getTrackContextMenuItems
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
  const track = (
    <div
      data-slot="timeline-editor-track"
      data-track-id={entry.track.id}
      className="grid"
      onPointerDownCapture={(event) => {
        if (
          entry.locked ||
          event.defaultPrevented ||
          !isTimelineEditorPrimaryPointerButton(event) ||
          (event.target instanceof Element &&
            (event.target.closest("[data-slot='timeline-editor-clip']") ||
              event.target.closest("[data-slot='timeline-editor-track-header']")))
        ) {
          return;
        }

        if (event.shiftKey) {
          editor.beginRangeSelection(event, entry.track.id);
          return;
        }

        event.stopPropagation();
        editor.beginTimelineScrub(event);
        editor.commitSelection({ itemIds: [] });
      }}
      style={{
        gridTemplateColumns: `${timelineEditorTrackHeaderWidthPx}px ${editor.timelineWidthPx}px`,
        minHeight: entry.track.height ?? timelineEditorDefaultTrackHeightPx,
        ...style,
      }}
    >
      <Header contextMenu={Boolean(editor.getTimelineContextMenuItems)} entry={entry} />
      <Lane components={components} entry={entry} />
    </div>
  );

  if (trackContextMenuItems.length === 0) {
    return track;
  }

  return (
    <TimelineEditorContextActionMenu
      items={trackContextMenuItems}
      contentProps={{ "data-slot": "timeline-editor-track-menu" }}
    >
      {track}
    </TimelineEditorContextActionMenu>
  );
}
