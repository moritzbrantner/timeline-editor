"use client";

import type { ReactNode } from "react";

import { ContextActionMenu } from "@moritzbrantner/ui";

import type {
  TimelineEditorDocument,
  TimelineEditorItem,
  TimelineEditorSelection,
  TimelineEditorTrack,
} from "../../types";
import { getVisibleTimelineEditorItems, type TimelineEditorVisibleRange } from "./viewport";
import { TimelineEditorClip } from "./clip";
import { timelineEditorTrackHeaderWidthPx } from "./constants";
import type {
  TimelineEditorItemContextMenuContext,
  TimelineEditorItemContextMenuItems,
  TimelineEditorItemRenderContext,
  TimelineEditorTrackContextMenuContext,
  TimelineEditorTrackContextMenuItems,
  TimelineEditorTrackRenderContext,
} from "./types";

type VisibleTrackEntry<TTrackData, TItemData> =
  | {
      type: "group";
      group: NonNullable<TimelineEditorDocument<TTrackData, TItemData>["groups"]>[number];
    }
  | {
      type: "track";
      track: TimelineEditorTrack<TTrackData, TItemData>;
      locked: boolean;
    };

type TimelineEditorTrackListProps<TTrackData extends Record<string, unknown>, TItemData> = {
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
  readOnly: boolean;
  selection: TimelineEditorSelection;
  selectedIds: ReadonlySet<string>;
  selectedItems: Array<TimelineEditorItem<TItemData>>;
  timelineWidthPx: number;
  visibleRange: TimelineEditorVisibleRange;
  visibleTracks: Array<VisibleTrackEntry<TTrackData, TItemData>>;
  getItemContextMenuItems?: TimelineEditorItemContextMenuItems<TTrackData, TItemData>;
  getTrackContextMenuItems?: TimelineEditorTrackContextMenuItems<TTrackData, TItemData>;
  renderItem?: (context: TimelineEditorItemRenderContext<TItemData>) => ReactNode;
  renderTrackHeader?: (context: TimelineEditorTrackRenderContext<TTrackData>) => ReactNode;
  onClipContextMenu: (item: TimelineEditorItem<TItemData>) => void;
  onClipPointerDown: (
    item: TimelineEditorItem<TItemData>,
    track: TimelineEditorTrack<TTrackData, TItemData>,
    locked: boolean,
    event: React.PointerEvent<HTMLDivElement>,
  ) => void;
  onResizePointerDown: (
    edge: "start" | "end",
    item: TimelineEditorItem<TItemData>,
    locked: boolean,
    event: React.PointerEvent<HTMLSpanElement>,
  ) => void;
};

export function TimelineEditorTrackList<TTrackData extends Record<string, unknown>, TItemData>({
  document,
  durationMs,
  readOnly,
  selection,
  selectedIds,
  selectedItems,
  timelineWidthPx,
  visibleRange,
  visibleTracks,
  getItemContextMenuItems,
  getTrackContextMenuItems,
  renderItem,
  renderTrackHeader,
  onClipContextMenu,
  onClipPointerDown,
  onResizePointerDown,
}: TimelineEditorTrackListProps<TTrackData, TItemData>) {
  return (
    <div data-slot="timeline-editor-tracks" className="divide-y">
      {visibleTracks.map((entry) =>
        entry.type === "group" ? (
          <div
            key={`group-${entry.group.id}`}
            data-slot="timeline-editor-track-group"
            data-collapsed={entry.group.collapsed ? "true" : undefined}
            className="flex h-9 items-center border-b bg-muted/50 px-3 text-xs font-medium text-muted-foreground"
          >
            {entry.group.label}
          </div>
        ) : (
          <TimelineEditorTrackRow
            key={entry.track.id}
            document={document}
            durationMs={durationMs}
            entry={entry}
            getItemContextMenuItems={getItemContextMenuItems}
            getTrackContextMenuItems={getTrackContextMenuItems}
            readOnly={readOnly}
            renderItem={renderItem}
            renderTrackHeader={renderTrackHeader}
            selectedIds={selectedIds}
            selectedItems={selectedItems}
            selection={selection}
            timelineWidthPx={timelineWidthPx}
            visibleRange={visibleRange}
            onClipContextMenu={onClipContextMenu}
            onClipPointerDown={onClipPointerDown}
            onResizePointerDown={onResizePointerDown}
          />
        ),
      )}
    </div>
  );
}

type TimelineEditorTrackRowProps<TTrackData extends Record<string, unknown>, TItemData> = Omit<
  TimelineEditorTrackListProps<TTrackData, TItemData>,
  "visibleTracks"
> & {
  entry: Extract<VisibleTrackEntry<TTrackData, TItemData>, { type: "track" }>;
};

function TimelineEditorTrackRow<TTrackData extends Record<string, unknown>, TItemData>({
  document,
  durationMs,
  entry,
  getItemContextMenuItems,
  getTrackContextMenuItems,
  readOnly,
  renderItem,
  renderTrackHeader,
  selectedIds,
  selectedItems,
  selection,
  timelineWidthPx,
  visibleRange,
  onClipContextMenu,
  onClipPointerDown,
  onResizePointerDown,
}: TimelineEditorTrackRowProps<TTrackData, TItemData>) {
  const trackContext = {
    document,
    durationMs,
    locked: Boolean(readOnly || entry.locked),
    readOnly,
    selection,
    selectedItems,
    track: entry.track,
  } satisfies TimelineEditorTrackContextMenuContext<TTrackData, TItemData>;
  const trackContextMenuItems = getTrackContextMenuItems?.(trackContext) ?? [];
  const track = (
    <div
      data-slot="timeline-editor-track"
      className="grid"
      style={{
        gridTemplateColumns: `${timelineEditorTrackHeaderWidthPx}px ${timelineWidthPx}px`,
        minHeight: entry.track.height ?? 56,
      }}
    >
      <div className="flex items-center border-r bg-muted/20 px-3 text-sm font-medium">
        {renderTrackHeader ? (
          renderTrackHeader({
            track: entry.track as TimelineEditorTrack<TTrackData, Record<string, unknown>>,
            locked: entry.locked,
            collapsed: false,
          })
        ) : (
          <span className="truncate">{entry.track.label}</span>
        )}
      </div>
      <div className="relative">
        {getVisibleTimelineEditorItems(entry.track.items, visibleRange, selectedIds).map((item) => {
          const selected = selectedIds.has(item.id);
          const locked = Boolean(readOnly || entry.locked || item.locked);
          const itemContext = {
            document,
            durationMs,
            item,
            readOnly: locked,
            selected,
            selectedItems,
            selection,
            track: entry.track,
          } satisfies TimelineEditorItemContextMenuContext<TTrackData, TItemData>;

          return (
            <TimelineEditorClip
              key={item.id}
              contextMenuItems={getItemContextMenuItems?.(itemContext) ?? []}
              durationMs={durationMs}
              item={item}
              locked={locked}
              readOnly={readOnly}
              renderItem={renderItem}
              selected={selected}
              timelineWidthPx={timelineWidthPx}
              onContextMenu={() => onClipContextMenu(item)}
              onMovePointerDown={(event) => onClipPointerDown(item, entry.track, locked, event)}
              onResizePointerDown={(edge, event) => onResizePointerDown(edge, item, locked, event)}
            />
          );
        })}
      </div>
    </div>
  );

  if (trackContextMenuItems.length === 0) {
    return <div>{track}</div>;
  }

  return (
    <ContextActionMenu
      items={trackContextMenuItems}
      contentProps={{ "data-slot": "timeline-editor-track-menu" }}
    >
      {track}
    </ContextActionMenu>
  );
}
