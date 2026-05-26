"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { ContextActionMenu, cn, type MenuActionItem } from "@moritzbrantner/ui";

import {
  moveTimelineEditorItems,
  resizeTimelineEditorItem,
  setTimelineEditorCurrentTime,
} from "../core";
import { applyTimelineEditorCommand } from "../commands";
import {
  clampTimelineEditorTime,
  createTimelineEditorSnapResolver,
  createTimelineEditorSnapOptions,
  getTimelineEditorItemEndMs,
} from "../time";
import {
  defaultTimelineEditorSelection,
  defaultTimelineEditorSnapMs,
  type TimelineEditorDocument,
  type TimelineEditorItem,
  type TimelineEditorSelection,
  type TimelineEditorSnapOptions,
  type TimelineEditorTrack,
  type TimelineEditorViewport,
} from "../types";
import {
  getTimelineEditorDurationForDocument,
  getTimelineEditorItemStyle,
  getTimelineEditorTimeFromDelta,
  getTimelineEditorTimeFromPointer,
  getTimelineEditorWidthPx,
  getVisibleTimelineEditorTicks,
} from "./timeline-rendering";

export type TimelineEditorHotkeys = {
  delete: string;
  nudgeLeft: string;
  nudgeRight: string;
  selectAll: string;
  zoomIn: string;
  zoomOut: string;
};

export type TimelineEditorItemRenderContext<TItemData = Record<string, unknown>> = {
  item: TimelineEditorItem<TItemData>;
  selected: boolean;
  readOnly: boolean;
};

export type TimelineEditorTrackRenderContext<TTrackData = Record<string, unknown>> = {
  track: TimelineEditorTrack<TTrackData, Record<string, unknown>>;
  locked: boolean;
  collapsed: boolean;
};

export type TimelineEditorItemContextMenuContext<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = TimelineEditorItemRenderContext<TItemData> & {
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
  selection: TimelineEditorSelection;
  selectedItems: Array<TimelineEditorItem<TItemData>>;
  track: TimelineEditorTrack<TTrackData, TItemData>;
};

export type TimelineEditorItemContextMenuItems<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = (context: TimelineEditorItemContextMenuContext<TTrackData, TItemData>) => MenuActionItem[];

export type TimelineEditorProps<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> = Omit<React.ComponentProps<"div">, "onChange"> & {
  document: TimelineEditorDocument<TTrackData, TItemData>;
  selection?: TimelineEditorSelection;
  viewport?: TimelineEditorViewport;
  readOnly?: boolean;
  snap?: Partial<TimelineEditorSnapOptions>;
  hotkeys?: Partial<TimelineEditorHotkeys>;
  onDocumentChange?: (document: TimelineEditorDocument<TTrackData, TItemData>) => void;
  onSelectionChange?: (selection: TimelineEditorSelection) => void;
  onViewportChange?: (viewport: TimelineEditorViewport) => void;
  onCurrentTimeChange?: (timeMs: number) => void;
  renderItem?: (context: TimelineEditorItemRenderContext<TItemData>) => ReactNode;
  renderTrackHeader?: (context: TimelineEditorTrackRenderContext<TTrackData>) => ReactNode;
  getItemContextMenuItems?: TimelineEditorItemContextMenuItems<TTrackData, TItemData>;
};

type TimelineEditorSnapResolver = ReturnType<typeof createTimelineEditorSnapResolver>;

type TimelineEditorDragState<TItemData> =
  | {
      type: "move";
      itemId: string;
      startX: number;
      originalItems: Array<TimelineEditorItem<TItemData>>;
      snapResolver: TimelineEditorSnapResolver;
    }
  | {
      type: "resize-start" | "resize-end";
      item: TimelineEditorItem<TItemData>;
      startX: number;
      originalStartMs: number;
      originalEndMs: number;
      snapResolver: TimelineEditorSnapResolver;
    };

type TimelineEditorVisibleRange = {
  startMs: number;
  endMs: number;
};

const timelineEditorViewportOverscanMs = 2_000;

export const defaultTimelineEditorHotkeys: TimelineEditorHotkeys = {
  delete: "Delete",
  nudgeLeft: "ArrowLeft",
  nudgeRight: "ArrowRight",
  selectAll: "Mod+A",
  zoomIn: "Mod+=",
  zoomOut: "Mod+-",
};

export function TimelineEditor<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>({
  document,
  selection = defaultTimelineEditorSelection,
  viewport,
  readOnly = false,
  snap,
  hotkeys,
  onDocumentChange,
  onSelectionChange,
  onViewportChange,
  onCurrentTimeChange,
  renderItem,
  renderTrackHeader,
  getItemContextMenuItems,
  className,
  onScroll,
  ...props
}: TimelineEditorProps<TTrackData, TItemData>) {
  const durationMs = getTimelineEditorDurationForDocument(document);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const previewTracksRef = useRef<Array<TimelineEditorTrack<TTrackData, TItemData>> | null>(null);
  const [measuredViewport, setMeasuredViewport] = useState({ scrollLeftPx: 0, widthPx: 1024 });
  const [previewTracks, setPreviewTracks] = useState<Array<
    TimelineEditorTrack<TTrackData, TItemData>
  > | null>(null);
  const resolvedViewport = useMemo(
    () =>
      ({
        pixelsPerSecond: viewport?.pixelsPerSecond ?? 80,
        scrollLeftMs: viewport?.scrollLeftMs,
        visibleStartMs: viewport?.visibleStartMs,
        visibleEndMs: viewport?.visibleEndMs,
      }) satisfies TimelineEditorViewport,
    [viewport],
  );
  const timelineWidthPx = getTimelineEditorWidthPx(durationMs, resolvedViewport.pixelsPerSecond);
  const resolvedSnap = useMemo(
    () => createTimelineEditorSnapOptions(defaultTimelineEditorSnapMs, snap),
    [snap],
  );
  const resolvedHotkeys = useMemo(
    () => ({ ...defaultTimelineEditorHotkeys, ...hotkeys }),
    [hotkeys],
  );
  const [dragState, setDragState] = useState<TimelineEditorDragState<TItemData> | null>(null);
  const [snapGuideMs, setSnapGuideMs] = useState<number | null>(null);
  const selectedIds = useMemo(() => new Set(selection.itemIds), [selection.itemIds]);
  const selectedItems = useMemo(
    () =>
      document.tracks.flatMap((track) => track.items.filter((item) => selectedIds.has(item.id))),
    [document.tracks, selectedIds],
  );
  const renderDocument = previewTracks ? { ...document, tracks: previewTracks } : document;
  const visibleRange = useMemo(
    () => getTimelineEditorVisibleRange(durationMs, resolvedViewport, measuredViewport),
    [durationMs, resolvedViewport, measuredViewport],
  );
  const visibleTracks = useMemo(() => getVisibleTracks(renderDocument), [renderDocument]);
  const ticks = useMemo(
    () =>
      getVisibleTimelineEditorTicks(durationMs, resolvedViewport).filter((tick) =>
        isTimelineEditorTimeVisible(tick.timeMs, visibleRange),
      ),
    [durationMs, resolvedViewport, visibleRange],
  );

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    const updateMeasuredViewport = () => {
      setMeasuredViewport({
        scrollLeftPx: scroller.scrollLeft,
        widthPx: scroller.clientWidth,
      });
    };

    updateMeasuredViewport();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateMeasuredViewport);
    observer.observe(scroller);

    return () => {
      observer.disconnect();
    };
  }, []);

  const commitDocument = (nextDocument: TimelineEditorDocument<TTrackData, TItemData>) => {
    onDocumentChange?.(nextDocument);
  };

  const commitSelection = (nextSelection: TimelineEditorSelection) => {
    onSelectionChange?.(nextSelection);
  };

  const updatePreviewTracks = (
    nextTracks: Array<TimelineEditorTrack<TTrackData, TItemData>> | null,
  ) => {
    previewTracksRef.current = nextTracks;
    setPreviewTracks(nextTracks);
  };

  const selectItem = (
    item: TimelineEditorItem<TItemData>,
    track: TimelineEditorTrack<TTrackData, TItemData>,
    event: React.PointerEvent,
  ) => {
    if (event.metaKey || event.ctrlKey) {
      const nextIds = selectedIds.has(item.id)
        ? selection.itemIds.filter((itemId) => itemId !== item.id)
        : [...selection.itemIds, item.id];
      commitSelection({ itemIds: nextIds, anchorItemId: item.id });
      return;
    }

    if (event.shiftKey && selection.anchorItemId) {
      commitSelection({
        itemIds: getRangeSelectionIds(track, selection.anchorItemId, item.id),
        anchorItemId: selection.anchorItemId,
      });
      return;
    }

    commitSelection({ itemIds: [item.id], anchorItemId: item.id });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState || readOnly) {
      return;
    }

    const deltaMs = getTimelineEditorTimeFromDelta(
      getTimelineEditorPointerClientX(event) - dragState.startX,
      resolvedViewport.pixelsPerSecond,
    );

    if (dragState.type === "move") {
      const activeItem = dragState.originalItems.find((item) => item.id === dragState.itemId);
      const snapResult = activeItem
        ? dragState.snapResolver(activeItem.startMs + deltaMs)
        : { timeMs: 0, snapped: false };
      const resolvedDeltaMs =
        activeItem && snapResult.snapped ? snapResult.timeMs - activeItem.startMs : deltaMs;
      const tracks = moveTimelineEditorItems(
        document.tracks,
        dragState.originalItems.map((item) => item.id),
        resolvedDeltaMs,
        { durationMs, snapMs: 0 },
      );

      setSnapGuideMs(snapResult.snapped ? snapResult.timeMs : null);
      updatePreviewTracks(tracks === document.tracks ? null : tracks);
      return;
    }

    const edge = dragState.type === "resize-start" ? "start" : "end";
    const nextTimeMs =
      edge === "start" ? dragState.originalStartMs + deltaMs : dragState.originalEndMs + deltaMs;
    const snapResult = dragState.snapResolver(nextTimeMs);
    const tracks = resizeTimelineEditorItem(
      document.tracks,
      edge === "start"
        ? {
            itemId: dragState.item.id,
            edge,
            startMs: snapResult.timeMs,
          }
        : {
            itemId: dragState.item.id,
            edge,
            durationMs: snapResult.timeMs - dragState.item.startMs,
          },
      { durationMs, snapMs: 0 },
    );

    setSnapGuideMs(snapResult.snapped ? snapResult.timeMs : null);
    updatePreviewTracks(tracks === document.tracks ? null : tracks);
  };

  const commitDrag = () => {
    const tracks = previewTracksRef.current;

    if (tracks && tracks !== document.tracks) {
      commitDocument({ ...document, tracks });
    }

    setDragState(null);
    setSnapGuideMs(null);
    updatePreviewTracks(null);
  };

  const cancelDrag = () => {
    setDragState(null);
    setSnapGuideMs(null);
    updatePreviewTracks(null);
  };

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    setMeasuredViewport({
      scrollLeftPx: event.currentTarget.scrollLeft,
      widthPx: event.currentTarget.clientWidth,
    });
    onScroll?.(event);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly) {
      return;
    }

    if (matchesHotkey(event, resolvedHotkeys.selectAll)) {
      event.preventDefault();
      commitSelection({
        itemIds: document.tracks
          .filter((track) => !isTrackLockedByGroup(document, track))
          .flatMap((track) => track.items.filter((item) => !item.locked).map((item) => item.id)),
      });
      return;
    }

    if (matchesHotkey(event, resolvedHotkeys.delete) || event.key === "Backspace") {
      event.preventDefault();
      const result = applyTimelineEditorCommand(
        document,
        selection,
        { type: "delete-selection" },
        { durationMs },
      );
      commitDocument(result.document);
      commitSelection(result.selection);
      return;
    }

    if (
      matchesHotkey(event, resolvedHotkeys.nudgeLeft) ||
      matchesHotkey(event, resolvedHotkeys.nudgeRight)
    ) {
      event.preventDefault();
      const direction = matchesHotkey(event, resolvedHotkeys.nudgeLeft) ? -1 : 1;
      const result = applyTimelineEditorCommand(
        document,
        selection,
        {
          type: "move-items",
          itemIds: selection.itemIds,
          deltaMs: direction * defaultTimelineEditorSnapMs,
        },
        { durationMs },
      );
      commitDocument(result.document);
      return;
    }

    if (
      matchesHotkey(event, resolvedHotkeys.zoomIn) ||
      matchesHotkey(event, resolvedHotkeys.zoomOut)
    ) {
      event.preventDefault();
      const direction = matchesHotkey(event, resolvedHotkeys.zoomIn) ? 1 : -1;
      onViewportChange?.({
        ...resolvedViewport,
        pixelsPerSecond: clampTimelineEditorTime(
          resolvedViewport.pixelsPerSecond + direction * 16,
          24,
          240,
        ),
      });
    }
  };

  return (
    <div
      data-slot="timeline-editor"
      data-read-only={readOnly ? "true" : undefined}
      ref={scrollerRef}
      className={cn("overflow-x-auto rounded-md border bg-card text-card-foreground", className)}
      tabIndex={0}
      onPointerMove={handlePointerMove}
      onPointerUp={commitDrag}
      onPointerCancel={cancelDrag}
      onKeyDown={handleKeyDown}
      onScroll={handleScroll}
      {...props}
    >
      <div className="relative" style={{ width: timelineWidthPx }}>
        <div
          data-slot="timeline-editor-ruler"
          className="relative h-10 border-b bg-muted/40"
          onPointerDown={(event) => {
            const timeMs = getTimelineEditorTimeFromPointer(event, durationMs);
            const nextDocument = setTimelineEditorCurrentTime(document, timeMs, {
              durationMs,
              snapMs: defaultTimelineEditorSnapMs,
            });
            onCurrentTimeChange?.(nextDocument.currentTimeMs ?? 0);
            commitDocument(nextDocument);
          }}
        >
          {ticks.map((tick) => (
            <div
              key={tick.timeMs}
              className="absolute top-0 h-full border-l border-border"
              style={{ left: `${(tick.timeMs / durationMs) * 100}%` }}
            >
              {tick.major ? (
                <span className="ml-1 text-[10px] text-muted-foreground">{tick.label}</span>
              ) : null}
            </div>
          ))}
          {(document.markers ?? [])
            .filter((marker) => isTimelineEditorTimeVisible(marker.timeMs, visibleRange))
            .map((marker) => (
              <div
                key={marker.id}
                data-slot="timeline-editor-marker"
                className="absolute top-0 h-full border-l-2"
                style={{
                  left: `${(marker.timeMs / durationMs) * 100}%`,
                  borderColor: marker.color ?? "var(--primary)",
                }}
                title={marker.label}
              />
            ))}
        </div>
        <div
          data-slot="timeline-editor-playhead"
          className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-primary"
          style={{
            left: `${(clampTimelineEditorTime(document.currentTimeMs ?? 0, 0, durationMs) / durationMs) * 100}%`,
          }}
        />
        {snapGuideMs !== null ? (
          <div
            data-slot="timeline-editor-snap-guide"
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-ring"
            style={{ left: `${(snapGuideMs / durationMs) * 100}%` }}
          />
        ) : null}
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
              <div
                key={entry.track.id}
                data-slot="timeline-editor-track"
                className="grid grid-cols-[9rem_minmax(0,1fr)]"
                style={{ minHeight: entry.track.height ?? 56 }}
              >
                <div className="flex items-center border-r bg-muted/20 px-3 text-sm font-medium">
                  {renderTrackHeader ? (
                    renderTrackHeader({
                      track: entry.track as TimelineEditorTrack<
                        TTrackData,
                        Record<string, unknown>
                      >,
                      locked: entry.locked,
                      collapsed: false,
                    })
                  ) : (
                    <span className="truncate">{entry.track.label}</span>
                  )}
                </div>
                <div className="relative">
                  {getVisibleTimelineEditorItems(entry.track.items, visibleRange, selectedIds).map(
                    (item) => {
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
                      const contextMenuItems = getItemContextMenuItems?.(itemContext) ?? [];
                      const clip = (
                        <div
                          data-slot="timeline-editor-clip"
                          data-selected={selected ? "true" : undefined}
                          role="button"
                          tabIndex={-1}
                          aria-pressed={selected}
                          className={cn(
                            "absolute top-2 bottom-2 flex min-w-8 cursor-grab items-center rounded-md border px-2 text-xs font-medium text-white shadow-sm outline-none data-[selected=true]:ring-2 data-[selected=true]:ring-ring",
                            locked && "cursor-default opacity-60",
                          )}
                          style={{
                            ...getTimelineEditorItemStyle(
                              item.startMs,
                              item.durationMs,
                              timelineWidthPx,
                              durationMs,
                            ),
                            backgroundColor: item.color ?? "var(--primary)",
                          }}
                          onContextMenu={() => {
                            if (!selectedIds.has(item.id)) {
                              commitSelection({ itemIds: [item.id], anchorItemId: item.id });
                            }
                          }}
                          onPointerDown={(event) => {
                            if (locked || event.button !== 0) {
                              return;
                            }

                            event.stopPropagation();
                            captureTimelineEditorPointer(event.currentTarget, event.pointerId);
                            selectItem(item, entry.track, event);
                            const activeSelection = selectedIds.has(item.id)
                              ? selection.itemIds
                              : [item.id];
                            const activeSelectionIds = new Set(activeSelection);
                            const originalItems = document.tracks.flatMap((track) =>
                              track.items.filter((candidate) =>
                                activeSelectionIds.has(candidate.id),
                              ),
                            );
                            setDragState({
                              type: "move",
                              itemId: item.id,
                              startX: getTimelineEditorPointerClientX(event),
                              originalItems,
                              snapResolver: createTimelineEditorSnapResolver(
                                document,
                                resolvedSnap,
                                resolvedViewport.pixelsPerSecond,
                                { excludeItemIds: activeSelectionIds },
                              ),
                            });
                          }}
                        >
                          <span
                            aria-hidden="true"
                            data-slot="timeline-editor-resize-start"
                            className="absolute inset-y-1 left-0 w-2 cursor-ew-resize rounded-l-md bg-white/25"
                            onPointerDown={(event) => {
                              if (locked || event.button !== 0) {
                                return;
                              }

                              event.stopPropagation();
                              captureTimelineEditorPointer(event.currentTarget, event.pointerId);
                              commitSelection({ itemIds: [item.id], anchorItemId: item.id });
                              setDragState({
                                type: "resize-start",
                                item,
                                startX: getTimelineEditorPointerClientX(event),
                                originalStartMs: item.startMs,
                                originalEndMs: getTimelineEditorItemEndMs(item),
                                snapResolver: createTimelineEditorSnapResolver(
                                  document,
                                  resolvedSnap,
                                  resolvedViewport.pixelsPerSecond,
                                  { excludeItemIds: [item.id] },
                                ),
                              });
                            }}
                          />
                          {renderItem ? (
                            renderItem({ item, selected, readOnly })
                          ) : (
                            <span className="truncate">{item.label}</span>
                          )}
                          <span
                            aria-hidden="true"
                            data-slot="timeline-editor-resize-end"
                            className="absolute inset-y-1 right-0 w-2 cursor-ew-resize rounded-r-md bg-white/25"
                            onPointerDown={(event) => {
                              if (locked || event.button !== 0) {
                                return;
                              }

                              event.stopPropagation();
                              captureTimelineEditorPointer(event.currentTarget, event.pointerId);
                              commitSelection({ itemIds: [item.id], anchorItemId: item.id });
                              setDragState({
                                type: "resize-end",
                                item,
                                startX: getTimelineEditorPointerClientX(event),
                                originalStartMs: item.startMs,
                                originalEndMs: getTimelineEditorItemEndMs(item),
                                snapResolver: createTimelineEditorSnapResolver(
                                  document,
                                  resolvedSnap,
                                  resolvedViewport.pixelsPerSecond,
                                  { excludeItemIds: [item.id] },
                                ),
                              });
                            }}
                          />
                        </div>
                      );

                      if (contextMenuItems.length === 0) {
                        return <div key={item.id}>{clip}</div>;
                      }

                      return (
                        <ContextActionMenu
                          key={item.id}
                          items={contextMenuItems}
                          contentProps={{ "data-slot": "timeline-editor-clip-menu" }}
                        >
                          {clip}
                        </ContextActionMenu>
                      );
                    },
                  )}
                </div>
              </div>
            ),
          )}
        </div>
        <span className="sr-only" aria-live="polite">
          {selection.itemIds.length > 0
            ? `${selection.itemIds.length} timeline items selected`
            : "No timeline items selected"}
        </span>
      </div>
    </div>
  );
}

function getVisibleTracks<TTrackData, TItemData>(
  document: TimelineEditorDocument<TTrackData, TItemData>,
) {
  const groupedTrackIds = new Set(document.groups?.flatMap((group) => group.trackIds));
  const entries: Array<
    | { type: "group"; group: NonNullable<typeof document.groups>[number] }
    | {
        type: "track";
        track: TimelineEditorTrack<TTrackData, TItemData>;
        locked: boolean;
      }
  > = [];

  for (const group of document.groups ?? []) {
    entries.push({ type: "group", group });

    if (group.collapsed) {
      continue;
    }

    for (const trackId of group.trackIds) {
      const track = document.tracks.find((candidate) => candidate.id === trackId);
      if (track) {
        entries.push({ type: "track", track, locked: Boolean(group.locked || track.locked) });
      }
    }
  }

  for (const track of document.tracks) {
    if (!groupedTrackIds.has(track.id)) {
      entries.push({ type: "track", track, locked: Boolean(track.locked) });
    }
  }

  return entries;
}

function isTrackLockedByGroup<TTrackData, TItemData>(
  document: TimelineEditorDocument<TTrackData, TItemData>,
  track: TimelineEditorTrack<TTrackData, TItemData>,
) {
  return Boolean(
    track.locked ||
    document.groups?.some((group) => group.locked && group.trackIds.includes(track.id)),
  );
}

function getTimelineEditorVisibleRange(
  durationMs: number,
  viewport: TimelineEditorViewport,
  measuredViewport: { scrollLeftPx: number; widthPx: number },
): TimelineEditorVisibleRange {
  const measuredStartMs =
    (measuredViewport.scrollLeftPx / Math.max(1, viewport.pixelsPerSecond)) * 1_000;
  const measuredDurationMs =
    measuredViewport.widthPx > 0
      ? (measuredViewport.widthPx / Math.max(1, viewport.pixelsPerSecond)) * 1_000
      : durationMs;
  const rawStartMs = viewport.visibleStartMs ?? viewport.scrollLeftMs ?? measuredStartMs;
  const rawEndMs = viewport.visibleEndMs ?? rawStartMs + measuredDurationMs;

  return {
    startMs: clampTimelineEditorTime(rawStartMs - timelineEditorViewportOverscanMs, 0, durationMs),
    endMs: clampTimelineEditorTime(rawEndMs + timelineEditorViewportOverscanMs, 0, durationMs),
  };
}

function isTimelineEditorTimeVisible(timeMs: number, range: TimelineEditorVisibleRange) {
  return timeMs >= range.startMs && timeMs <= range.endMs;
}

function getVisibleTimelineEditorItems<TItemData>(
  items: Array<TimelineEditorItem<TItemData>>,
  range: TimelineEditorVisibleRange,
  selectedIds: ReadonlySet<string>,
) {
  return items.filter(
    (item) =>
      selectedIds.has(item.id) ||
      (item.startMs <= range.endMs && getTimelineEditorItemEndMs(item) >= range.startMs),
  );
}

function getTimelineEditorPointerClientX(event: Pick<React.PointerEvent, "clientX">) {
  return Number.isFinite(event.clientX) ? event.clientX : 0;
}

function captureTimelineEditorPointer(element: Element, pointerId: number) {
  if (
    Number.isFinite(pointerId) &&
    "setPointerCapture" in element &&
    typeof element.setPointerCapture === "function"
  ) {
    element.setPointerCapture(pointerId);
  }
}

function getRangeSelectionIds<TTrackData, TItemData>(
  track: TimelineEditorTrack<TTrackData, TItemData>,
  anchorItemId: string,
  itemId: string,
) {
  const sortedItems = [...track.items].sort(
    (left, right) => left.startMs - right.startMs || left.id.localeCompare(right.id),
  );
  const anchorIndex = sortedItems.findIndex((item) => item.id === anchorItemId);
  const itemIndex = sortedItems.findIndex((item) => item.id === itemId);

  if (anchorIndex === -1 || itemIndex === -1) {
    return [itemId];
  }

  const [startIndex, endIndex] =
    anchorIndex < itemIndex ? [anchorIndex, itemIndex] : [itemIndex, anchorIndex];

  return sortedItems.slice(startIndex, endIndex + 1).map((item) => item.id);
}

function matchesHotkey(event: React.KeyboardEvent, hotkey: string) {
  const parts = hotkey.split("+").map((part) => part.toLowerCase());
  const expectedKey = parts.at(-1);
  const needsMod = parts.includes("mod");
  const needsShift = parts.includes("shift");
  const needsAlt = parts.includes("alt");
  const needsCtrl = parts.includes("ctrl");
  const key = event.key.toLowerCase();

  if (needsMod && !(event.metaKey || event.ctrlKey)) {
    return false;
  }

  if (needsCtrl && !event.ctrlKey) {
    return false;
  }

  if (needsShift !== event.shiftKey) {
    return false;
  }

  if (needsAlt !== event.altKey) {
    return false;
  }

  return expectedKey === key || (expectedKey === "delete" && event.key === "Delete");
}
