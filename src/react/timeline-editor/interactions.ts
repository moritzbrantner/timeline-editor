import type React from "react";

import {
  canPlaceTimelineEditorItemOnTrack,
  findTimelineEditorItem,
  moveTimelineEditorItems,
  resizeTimelineEditorItem,
} from "../../core";
import { clampTimelineEditorTime, getTimelineEditorItemEndMs } from "../../time";
import type {
  TimelineEditorDocument,
  TimelineEditorEditPolicy,
  TimelineEditorItem,
  TimelineEditorTrack,
} from "../../types";
import { getTimelineEditorTimeFromDelta } from "../timeline-rendering";
import {
  timelineEditorDefaultTrackHeightPx,
  timelineEditorRulerHeightPx,
  timelineEditorTrackGroupHeightPx,
  timelineEditorTrackHeaderWidthPx,
} from "./constants";
import { getTimelineEditorPointerClientX } from "./pointer";
import type { TimelineEditorDragState, TimelineEditorTrackEntry } from "./types";

export type TimelineEditorSnapResolver = (timeMs: number) => {
  snapped: boolean;
  timeMs: number;
};

export function getTimelineEditorDragCommitTracks<
  TTrackData extends Record<string, unknown>,
  TItemData,
>(
  document: TimelineEditorDocument<TTrackData, TItemData>,
  visibleTracks: Array<TimelineEditorTrackEntry<TTrackData, TItemData>>,
  scroller: HTMLDivElement | null,
  event: React.PointerEvent<HTMLDivElement>,
  dragState: TimelineEditorDragState<TItemData, TimelineEditorSnapResolver>,
  pixelsPerSecond: number,
  durationMs: number,
  editPolicy: Partial<TimelineEditorEditPolicy> | undefined,
) {
  const deltaMs = getTimelineEditorTimeFromDelta(
    getTimelineEditorPointerClientX(event) - dragState.startX,
    pixelsPerSecond,
  );

  if (dragState.type === "move") {
    const activeItem = dragState.originalItems.find((item) => item.id === dragState.itemId);
    const snapResult = activeItem
      ? dragState.snapResolver(activeItem.startMs + deltaMs)
      : { timeMs: 0, snapped: false };
    const resolvedDeltaMs =
      activeItem && snapResult.snapped ? snapResult.timeMs - activeItem.startMs : deltaMs;

    return getTimelineEditorMoveDragTracks(
      document,
      visibleTracks,
      scroller,
      event.clientY,
      dragState,
      resolvedDeltaMs,
      durationMs,
      editPolicy,
    );
  }

  const edge = dragState.type === "resize-start" ? "start" : "end";
  const nextTimeMs =
    edge === "start" ? dragState.originalStartMs + deltaMs : dragState.originalEndMs + deltaMs;
  const snapResult = dragState.snapResolver(nextTimeMs);

  return getTimelineEditorResizeDragTracks(
    document.tracks,
    dragState.item,
    edge,
    snapResult.timeMs,
    durationMs,
    editPolicy,
  );
}

export function getTimelineEditorMoveDragTracks<
  TTrackData extends Record<string, unknown>,
  TItemData,
>(
  document: TimelineEditorDocument<TTrackData, TItemData>,
  visibleTracks: Array<TimelineEditorTrackEntry<TTrackData, TItemData>>,
  scroller: HTMLDivElement | null,
  clientY: number,
  dragState: Extract<
    TimelineEditorDragState<TItemData, TimelineEditorSnapResolver>,
    { type: "move" }
  >,
  deltaMs: number,
  durationMs: number,
  editPolicy: Partial<TimelineEditorEditPolicy> | undefined,
) {
  const targetTrackId = getTimelineEditorTrackIdAtClientY(visibleTracks, scroller, clientY);
  const sourceTrackIndex = document.tracks.findIndex(
    (track) => track.id === dragState.sourceTrackId,
  );
  const targetTrackIndex =
    targetTrackId === undefined
      ? -1
      : document.tracks.findIndex((track) => track.id === targetTrackId);
  const trackDelta =
    sourceTrackIndex === -1 || targetTrackIndex === -1
      ? undefined
      : targetTrackIndex - sourceTrackIndex;

  if (
    trackDelta !== undefined &&
    trackDelta !== 0 &&
    !canMoveTimelineEditorItemsByTrackDelta(
      document.tracks,
      dragState.movingItemIds,
      trackDelta,
      visibleTracks,
    )
  ) {
    return document.tracks;
  }

  return moveTimelineEditorItems(document.tracks, [...dragState.movingItemIds], deltaMs, {
    durationMs,
    editPolicy,
    ...(trackDelta !== undefined && trackDelta !== 0 ? { trackDelta } : {}),
  });
}

export function getTimelineEditorTrackIdAtClientY<TTrackData, TItemData>(
  visibleTracks: Array<TimelineEditorTrackEntry<TTrackData, TItemData>>,
  scroller: HTMLDivElement | null,
  clientY: number,
) {
  if (!scroller || !Number.isFinite(clientY)) {
    return undefined;
  }

  const bounds = scroller.getBoundingClientRect();
  const yPx = clientY - bounds.top + scroller.scrollTop - timelineEditorRulerHeightPx;
  let topPx = 0;
  let nearestTrackId: string | undefined;
  let nearestDistancePx = Number.POSITIVE_INFINITY;

  for (const entry of visibleTracks) {
    const heightPx =
      entry.type === "group"
        ? timelineEditorTrackGroupHeightPx
        : (entry.track.height ?? timelineEditorDefaultTrackHeightPx);
    const bottomPx = topPx + heightPx;

    if (yPx >= topPx && yPx <= bottomPx && (entry.type !== "track" || entry.locked)) {
      return undefined;
    }

    if (entry.type === "track" && !entry.locked) {
      if (yPx >= topPx && yPx <= bottomPx) {
        return entry.track.id;
      }

      const distancePx = yPx < topPx ? topPx - yPx : yPx - bottomPx;

      if (distancePx < nearestDistancePx) {
        nearestDistancePx = distancePx;
        nearestTrackId = entry.track.id;
      }
    }

    topPx = bottomPx;
  }

  return nearestTrackId;
}

export function canMoveTimelineEditorItemsByTrackDelta<TTrackData, TItemData>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  movingItemIds: ReadonlySet<string>,
  trackDelta: number,
  visibleTracks: Array<TimelineEditorTrackEntry<TTrackData, TItemData>>,
) {
  const lockedTrackIds = new Set(
    visibleTracks
      .filter((entry) => entry.type === "track" && entry.locked)
      .map((entry) => (entry.type === "track" ? entry.track.id : "")),
  );

  for (const itemId of movingItemIds) {
    const found = findTimelineEditorItem(tracks, itemId);

    if (!found || found.item.locked || found.track.locked) {
      return false;
    }

    const currentTrackIndex = tracks.findIndex((track) => track.id === found.track.id);
    const targetTrack =
      tracks[clampTimelineEditorTime(currentTrackIndex + trackDelta, 0, tracks.length - 1)];

    if (
      !targetTrack ||
      lockedTrackIds.has(targetTrack.id) ||
      !canPlaceTimelineEditorItemOnTrack(found.item, targetTrack)
    ) {
      return false;
    }
  }

  return true;
}

export function normalizeTimelineEditorDragRange(startMs: number, endMs: number) {
  return startMs <= endMs ? { startMs, endMs } : { startMs: endMs, endMs: startMs };
}

export function getTimelineEditorEventTrackId(event: React.MouseEvent<Element>) {
  const target = event.target instanceof Element ? event.target : null;

  if (
    target?.closest("[data-slot='timeline-editor-ruler']") ||
    target?.closest("[data-slot='timeline-editor-clip']") ||
    target?.closest("[data-slot='timeline-editor-track-header']")
  ) {
    return undefined;
  }

  return target?.closest<HTMLElement>("[data-slot='timeline-editor-track']")?.dataset["trackId"];
}

export function getTimelineEditorNativeEventTrackId(event: MouseEvent) {
  const target = event.target instanceof Element ? event.target : null;

  if (
    target?.closest("[data-slot='timeline-editor-ruler']") ||
    target?.closest("[data-slot='timeline-editor-clip']") ||
    target?.closest("[data-slot='timeline-editor-track-header']")
  ) {
    return undefined;
  }

  return target?.closest<HTMLElement>("[data-slot='timeline-editor-track']")?.dataset["trackId"];
}

export function getTimelineEditorResizeDragTracks<TTrackData, TItemData>(
  tracks: Array<TimelineEditorTrack<TTrackData, TItemData>>,
  item: TimelineEditorItem<TItemData>,
  edge: "start" | "end",
  timeMs: number,
  durationMs: number,
  editPolicy: Partial<TimelineEditorEditPolicy> | undefined,
) {
  return resizeTimelineEditorItem(
    tracks,
    edge === "start"
      ? { itemId: item.id, edge, startMs: timeMs }
      : { itemId: item.id, edge, durationMs: timeMs - item.startMs },
    { durationMs, editPolicy },
  );
}

export function getTimelineEditorWheelDeltaPx(
  delta: number,
  deltaMode: number,
  scroller: HTMLDivElement,
) {
  if (deltaMode === 1) {
    return delta * 40;
  }

  if (deltaMode === 2) {
    return delta * scroller.clientWidth;
  }

  return delta;
}

export function getTimelineEditorTimeAtClientX(
  clientX: number,
  scroller: HTMLDivElement | null,
  pixelsPerSecond: number,
  durationMs: number,
) {
  if (!scroller) {
    return 0;
  }

  const scrollerRect = scroller.getBoundingClientRect();
  const timelineOffsetPx =
    clientX - scrollerRect.left + scroller.scrollLeft - timelineEditorTrackHeaderWidthPx;
  return clampTimelineEditorTime(
    (timelineOffsetPx / Math.max(1, pixelsPerSecond)) * 1_000,
    0,
    durationMs,
  );
}

export function getTimelineEditorItemEndTime<TItemData>(item: TimelineEditorItem<TItemData>) {
  return getTimelineEditorItemEndMs(item);
}
