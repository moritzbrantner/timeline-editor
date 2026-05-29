"use client";

import { useEffect, useState, type RefObject } from "react";

import { getTimelineEditorItemEndMs, type TimelineEditorItem } from "../../core";
import type { TimelinePreviewTransportContext } from "./types";

export type TimelineWorkbenchSynchronizedMediaElementOptions = {
  elementRef: RefObject<HTMLMediaElement | null>;
  item: TimelineEditorItem<unknown>;
  transport: TimelinePreviewTransportContext;
  currentTimeMs: number;
  durationMs: number;
  sourceStartMs?: number;
  sourceEndMs?: number;
  muted?: boolean;
  volume?: number;
};

export function useTimelineWorkbenchSynchronizedMediaElement({
  elementRef,
  item,
  transport,
  currentTimeMs,
  durationMs: _durationMs,
  sourceStartMs = 0,
  sourceEndMs,
  muted,
  volume,
}: TimelineWorkbenchSynchronizedMediaElementOptions) {
  const [blocked, setBlocked] = useState(false);
  const localTimeMs = getTimelineWorkbenchMediaLocalTimeMs(item, currentTimeMs, {
    sourceStartMs,
    sourceEndMs,
  });
  const active = currentTimeMs >= item.startMs && currentTimeMs <= getTimelineEditorItemEndMs(item);

  useEffect(() => {
    const element = elementRef.current;

    if (!element) {
      return;
    }

    if (muted !== undefined) {
      element.muted = muted;
    }

    if (volume !== undefined) {
      element.volume = Math.max(0, Math.min(1, volume));
    }
  }, [elementRef, muted, volume]);

  useEffect(() => {
    const element = elementRef.current;

    if (!element) {
      return;
    }

    const localTimeSeconds = localTimeMs / 1_000;
    const driftMs = Math.abs(element.currentTime - localTimeSeconds) * 1_000;
    const seek = () => {
      if (Number.isFinite(localTimeSeconds)) {
        element.currentTime = localTimeSeconds;
      }
    };

    if (!active) {
      pauseTimelineWorkbenchMediaElement(element);
      seek();
      return;
    }

    if (transport.status !== "playing") {
      pauseTimelineWorkbenchMediaElement(element);
      if (driftMs > 40) {
        seek();
      }
      return;
    }

    if (transport.playbackRate < 0) {
      pauseTimelineWorkbenchMediaElement(element);
      seek();
      return;
    }

    element.playbackRate = transport.playbackRate;
    if (driftMs > 80) {
      seek();
    }

    const playResult = element.play();

    if (playResult && typeof playResult.catch === "function") {
      playResult.then(() => setBlocked(false)).catch(() => setBlocked(true));
    }
  }, [active, currentTimeMs, elementRef, localTimeMs, transport.playbackRate, transport.status]);

  useEffect(
    () => () => {
      if (elementRef.current) {
        pauseTimelineWorkbenchMediaElement(elementRef.current);
      }
    },
    [elementRef],
  );

  return { blocked, localTimeMs };
}

function pauseTimelineWorkbenchMediaElement(element: HTMLMediaElement) {
  if (element.paused) {
    return;
  }

  try {
    element.pause();
  } catch {
    // Test DOMs and some browser edge cases can expose media elements without usable controls.
  }
}

function getTimelineWorkbenchMediaLocalTimeMs(
  item: TimelineEditorItem<unknown>,
  currentTimeMs: number,
  options: { sourceStartMs: number; sourceEndMs?: number },
) {
  const unclampedLocalTimeMs = currentTimeMs - item.startMs + options.sourceStartMs;
  const lowerBoundMs = Math.max(0, options.sourceStartMs);
  const upperBoundMs = options.sourceEndMs ?? lowerBoundMs + item.durationMs;

  return Math.max(lowerBoundMs, Math.min(upperBoundMs, unclampedLocalTimeMs));
}
