"use client";

import { memo } from "react";
import type { ReactNode } from "react";

import { ContextActionMenu } from "@moritzbrantner/ui";

import type {
  TimelineEditorDocument,
  TimelineEditorItem,
  TimelineEditorSelection,
  TimelineEditorTick,
  TimelineEditorTrack,
} from "../../types";
import { TimelineEditorContextMenuTarget } from "./context-menu";
import {
  getVisibleTimelineEditorItems,
  type TimelineEditorMeasuredViewport,
  type TimelineEditorVisibleRange,
} from "./viewport";
import { TimelineEditorClip } from "./clip";
import {
  timelineEditorDefaultTrackHeightPx,
  timelineEditorRulerHeightPx,
  timelineEditorTrackGroupHeightPx,
  timelineEditorTrackHeaderWidthPx,
} from "./constants";
import type {
  TimelineEditorItemContextMenuContext,
  TimelineEditorItemContextMenuItems,
  TimelineEditorItemRenderContext,
  TimelineEditorTrackContextMenuContext,
  TimelineEditorTrackContextMenuItems,
  TimelineEditorTrackGroupRenderContext,
  TimelineEditorTrackRenderContext,
  TimelineEditorTimelineContextMenuContext,
  TimelineEditorTimelineContextMenuItems,
  TimelineEditorVirtualizationOptions,
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
  ticks: TimelineEditorTick[];
  timelineWidthPx: number;
  measuredViewport: TimelineEditorMeasuredViewport;
  visibleRange: TimelineEditorVisibleRange;
  visibleTracks: Array<VisibleTrackEntry<TTrackData, TItemData>>;
  virtualization: Required<TimelineEditorVirtualizationOptions>;
  getItemContextMenuItems?: TimelineEditorItemContextMenuItems<TTrackData, TItemData>;
  getTimelineContextMenuContext?: (
    event: React.MouseEvent<Element>,
    track: TimelineEditorTrack<TTrackData, TItemData>,
    locked: boolean,
  ) => TimelineEditorTimelineContextMenuContext<TTrackData, TItemData>;
  getTimelineContextMenuItems?: TimelineEditorTimelineContextMenuItems<TTrackData, TItemData>;
  getTrackContextMenuItems?: TimelineEditorTrackContextMenuItems<TTrackData, TItemData>;
  renderItem?: (context: TimelineEditorItemRenderContext<TItemData>) => ReactNode;
  renderTrackGroupHeader?: (context: TimelineEditorTrackGroupRenderContext) => ReactNode;
  renderTrackHeader?: (context: TimelineEditorTrackRenderContext<TTrackData>) => ReactNode;
  onClipContextMenu: (item: TimelineEditorItem<TItemData>) => void;
  onClipPointerDown: (
    item: TimelineEditorItem<TItemData>,
    track: TimelineEditorTrack<TTrackData, TItemData>,
    locked: boolean,
    event: React.PointerEvent<HTMLDivElement>,
  ) => void;
  onTrackLanePointerDown: (
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
  ticks,
  timelineWidthPx,
  measuredViewport,
  visibleRange,
  visibleTracks,
  virtualization,
  getItemContextMenuItems,
  getTimelineContextMenuContext,
  getTimelineContextMenuItems,
  getTrackContextMenuItems,
  renderItem,
  renderTrackGroupHeader,
  renderTrackHeader,
  onClipContextMenu,
  onClipPointerDown,
  onTrackLanePointerDown,
  onResizePointerDown,
}: TimelineEditorTrackListProps<TTrackData, TItemData>) {
  const rows = getTimelineEditorTrackRows(visibleTracks);
  const totalHeightPx = rows.at(-1) ? rows.at(-1)!.topPx + rows.at(-1)!.heightPx : 0;
  const viewportStartPx = Math.max(0, measuredViewport.scrollTopPx - timelineEditorRulerHeightPx);
  const viewportHeightPx = Math.max(0, measuredViewport.heightPx);
  const shouldVirtualizeRows =
    virtualization.rows === true ||
    (virtualization.rows === "auto" && viewportHeightPx > 0 && totalHeightPx > viewportHeightPx);
  const renderedRows = shouldVirtualizeRows
    ? rows.filter(
        (row) =>
          row.topPx + row.heightPx >= viewportStartPx - virtualization.rowOverscanPx &&
          row.topPx <= viewportStartPx + viewportHeightPx + virtualization.rowOverscanPx,
      )
    : rows;
  const content = renderedRows.map((row) => {
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
      <div
        key={`group-${row.entry.group.id}`}
        style={rowStyle}
        data-slot="timeline-editor-track-group"
        data-collapsed={row.entry.group.collapsed ? "true" : undefined}
        className="flex h-9 items-center border-b bg-muted/50 px-3 text-xs font-medium text-muted-foreground"
      >
        {renderTrackGroupHeader
          ? renderTrackGroupHeader({
              group: row.entry.group,
              collapsed: Boolean(row.entry.group.collapsed),
              locked: Boolean(row.entry.group.locked),
            })
          : row.entry.group.label}
      </div>
    ) : (
      <div key={row.entry.track.id} style={rowStyle}>
        <TimelineEditorTrackRow
          document={document}
          durationMs={durationMs}
          entry={row.entry}
          getItemContextMenuItems={getItemContextMenuItems}
          getTimelineContextMenuContext={getTimelineContextMenuContext}
          getTimelineContextMenuItems={getTimelineContextMenuItems}
          getTrackContextMenuItems={getTrackContextMenuItems}
          readOnly={readOnly}
          renderItem={renderItem}
          renderTrackGroupHeader={renderTrackGroupHeader}
          renderTrackHeader={renderTrackHeader}
          selectedIds={selectedIds}
          selectedItems={selectedItems}
          selection={selection}
          ticks={ticks}
          timelineWidthPx={timelineWidthPx}
          visibleRange={visibleRange}
          onClipContextMenu={onClipContextMenu}
          onClipPointerDown={onClipPointerDown}
          onTrackLanePointerDown={onTrackLanePointerDown}
          onResizePointerDown={onResizePointerDown}
        />
      </div>
    );
  });

  return (
    <div
      data-slot="timeline-editor-tracks"
      data-virtualized={shouldVirtualizeRows ? "true" : undefined}
      className={shouldVirtualizeRows ? "relative" : "divide-y"}
      style={shouldVirtualizeRows ? { height: totalHeightPx } : undefined}
    >
      {content}
    </div>
  );
}

type TimelineEditorTrackRowEntry<TTrackData, TItemData> = {
  entry: VisibleTrackEntry<TTrackData, TItemData>;
  topPx: number;
  heightPx: number;
};

function getTimelineEditorTrackRows<TTrackData, TItemData>(
  visibleTracks: Array<VisibleTrackEntry<TTrackData, TItemData>>,
) {
  const rows: Array<TimelineEditorTrackRowEntry<TTrackData, TItemData>> = [];
  let topPx = 0;

  for (const entry of visibleTracks) {
    const heightPx =
      entry.type === "group"
        ? timelineEditorTrackGroupHeightPx
        : (entry.track.height ?? timelineEditorDefaultTrackHeightPx);

    rows.push({ entry, topPx, heightPx });
    topPx += heightPx;
  }

  return rows;
}

type TimelineEditorTrackRowProps<TTrackData extends Record<string, unknown>, TItemData> = Omit<
  TimelineEditorTrackListProps<TTrackData, TItemData>,
  "measuredViewport" | "virtualization" | "visibleTracks"
> & {
  entry: Extract<VisibleTrackEntry<TTrackData, TItemData>, { type: "track" }>;
};

function TimelineEditorTrackRowComponent<TTrackData extends Record<string, unknown>, TItemData>({
  document,
  durationMs,
  entry,
  getItemContextMenuItems,
  getTimelineContextMenuContext,
  getTimelineContextMenuItems,
  getTrackContextMenuItems,
  readOnly,
  renderItem,
  renderTrackHeader,
  selectedIds,
  selectedItems,
  selection,
  ticks,
  timelineWidthPx,
  visibleRange,
  onClipContextMenu,
  onClipPointerDown,
  onTrackLanePointerDown,
  onResizePointerDown,
}: TimelineEditorTrackRowProps<TTrackData, TItemData>) {
  const trackContextMenuItems = getTrackContextMenuItems
    ? getTrackContextMenuItems({
        document,
        durationMs,
        locked: Boolean(readOnly || entry.locked),
        readOnly,
        selection,
        selectedItems,
        track: entry.track,
      } satisfies TimelineEditorTrackContextMenuContext<TTrackData, TItemData>)
    : [];
  const trackHeader = (
    <div
      data-slot="timeline-editor-track-header"
      className="flex items-center border-r bg-muted/20 px-3 text-sm font-medium"
    >
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
  );
  const trackLane = (
    <div
      data-slot="timeline-editor-track-lane"
      className="relative"
      onPointerDown={(event) => onTrackLanePointerDown(entry.track, entry.locked, event)}
    >
      <TimelineEditorTrackGrid
        durationMs={durationMs}
        ticks={ticks}
        timelineWidthPx={timelineWidthPx}
      />
      {selection.range &&
      (!selection.trackIds?.length || selection.trackIds.includes(entry.track.id)) ? (
        <TimelineEditorRangeOverlay
          durationMs={durationMs}
          range={selection.range}
          timelineWidthPx={timelineWidthPx}
        />
      ) : null}
      {getVisibleTimelineEditorItems(entry.track.items, visibleRange, selectedIds).map((item) => {
        const selected = selectedIds.has(item.id);
        const locked = Boolean(readOnly || entry.locked || item.locked);
        const contextMenuItems = getItemContextMenuItems
          ? getItemContextMenuItems({
              document,
              durationMs,
              item,
              readOnly: locked,
              selected,
              selectedItems,
              selection,
              track: entry.track,
            } satisfies TimelineEditorItemContextMenuContext<TTrackData, TItemData>)
          : [];

        return (
          <TimelineEditorClip
            key={item.id}
            contextMenuItems={contextMenuItems}
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
  );
  const timelineMenuEnabled = Boolean(getTimelineContextMenuItems);
  const track = (
    <div
      data-slot="timeline-editor-track"
      data-track-id={entry.track.id}
      className="grid"
      onPointerDownCapture={(event) => onTrackLanePointerDown(entry.track, entry.locked, event)}
      style={{
        gridTemplateColumns: `${timelineEditorTrackHeaderWidthPx}px ${timelineWidthPx}px`,
        minHeight: entry.track.height ?? timelineEditorDefaultTrackHeightPx,
      }}
    >
      {timelineMenuEnabled && trackContextMenuItems.length > 0 ? (
        <ContextActionMenu
          items={trackContextMenuItems}
          contentProps={{ "data-slot": "timeline-editor-track-menu" }}
        >
          {trackHeader}
        </ContextActionMenu>
      ) : (
        trackHeader
      )}
      {timelineMenuEnabled && getTimelineContextMenuContext ? (
        <TimelineEditorContextMenuTarget
          contentProps={{ "data-slot": "timeline-editor-timeline-menu" }}
          getContext={(event) => getTimelineContextMenuContext(event, entry.track, entry.locked)}
          getItems={getTimelineContextMenuItems}
        >
          {trackLane}
        </TimelineEditorContextMenuTarget>
      ) : (
        trackLane
      )}
    </div>
  );

  if (timelineMenuEnabled || trackContextMenuItems.length === 0) {
    return track;
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

const TimelineEditorTrackRow = memo(
  TimelineEditorTrackRowComponent,
) as typeof TimelineEditorTrackRowComponent;

function TimelineEditorRangeOverlay({
  durationMs,
  range,
  timelineWidthPx,
}: {
  durationMs: number;
  range: { startMs: number; endMs: number };
  timelineWidthPx: number;
}) {
  const startMs = Math.max(0, Math.min(range.startMs, range.endMs));
  const endMs = Math.max(startMs, Math.max(range.startMs, range.endMs));
  const leftPx = (startMs / durationMs) * timelineWidthPx;
  const widthPx = Math.max(1, ((endMs - startMs) / durationMs) * timelineWidthPx);

  return (
    <div
      data-slot="timeline-editor-range-overlay"
      className="pointer-events-none absolute inset-y-0 z-10 border-x border-primary/60 bg-primary/15"
      style={{ left: leftPx, width: widthPx }}
    />
  );
}

function TimelineEditorTrackGrid({
  durationMs,
  ticks,
  timelineWidthPx,
}: {
  durationMs: number;
  ticks: TimelineEditorTick[];
  timelineWidthPx: number;
}) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {ticks.map((tick) => (
        <span
          key={tick.timeMs}
          data-slot="timeline-editor-track-tick"
          className={`absolute inset-y-0 border-l ${
            tick.major ? "border-border/70" : "border-border/35"
          }`}
          style={{ left: `${(tick.timeMs / durationMs) * timelineWidthPx}px` }}
        />
      ))}
    </div>
  );
}
