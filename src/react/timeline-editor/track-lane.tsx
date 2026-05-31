"use client";

import { getVisibleTimelineEditorItems } from "./viewport";
import { TimelineEditorContextMenuTarget } from "./context-menu";
import { TimelineEditorClip } from "./clip";
import { TimelineEditorRangeOverlay } from "./overlays";
import { isTimelineEditorPrimaryPointerButton } from "./pointer";
import { useTimelineEditor } from "./provider";
import { TimelineEditorTrackGrid } from "./track-grid";
import type { TimelineEditorTrackLaneProps } from "./types";

export function TimelineEditorTrackLane<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>({ components, entry }: TimelineEditorTrackLaneProps<TTrackData, TItemData>) {
  const editor = useTimelineEditor<TTrackData, TItemData>();
  const Grid = components?.TrackGrid ?? TimelineEditorTrackGrid;
  const Clip = components?.Clip ?? TimelineEditorClip;
  const RangeOverlay = components?.RangeOverlay ?? TimelineEditorRangeOverlay;
  const trackLane = (
    <div
      data-slot="timeline-editor-track-lane"
      className="relative"
      onPointerDown={(event) => {
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
    >
      <Grid />
      {editor.selection.range &&
      (!editor.selection.trackIds?.length || editor.selection.trackIds.includes(entry.track.id)) ? (
        <RangeOverlay range={editor.selection.range} />
      ) : null}
      {getVisibleTimelineEditorItems(
        entry.track.items,
        editor.visibleRange,
        editor.selectedIds,
      ).map((item) => (
        <Clip key={item.id} item={item} locked={entry.locked} track={entry.track as never} />
      ))}
    </div>
  );

  if (editor.getTimelineContextMenuItems) {
    return (
      <TimelineEditorContextMenuTarget
        contentProps={{ "data-slot": "timeline-editor-timeline-menu" }}
        getContext={(event) =>
          editor.getTimelineContextMenuContext("track-lane", event, entry.track, entry.locked)
        }
        getItems={editor.getTimelineContextMenuItems}
      >
        {trackLane}
      </TimelineEditorContextMenuTarget>
    );
  }

  return trackLane;
}
