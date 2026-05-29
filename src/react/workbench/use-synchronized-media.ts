"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { getTimelineEditorItemEndMs, type TimelineEditorItem } from "../../core";
import type { TimelinePreviewTransportContext } from "./types";

export type TimelineWorkbenchSynchronizedMediaElementOptions = {
  elementRef: RefObject<HTMLMediaElement | null>;
  item: TimelineEditorItem<unknown>;
  transport: TimelinePreviewTransportContext;
  currentTimeMs: number;
  sourceStartMs?: number;
  sourceEndMs?: number;
  muted?: boolean;
  volume?: number;
};

const forwardPlaybackSeekThresholdMs = 500;
const pausedSeekThresholdMs = 40;
const startupSeekThresholdMs = 80;

export function useTimelineWorkbenchSynchronizedMediaElement({
  elementRef,
  item,
  transport,
  currentTimeMs,
  sourceStartMs = 0,
  sourceEndMs,
  muted,
  volume,
}: TimelineWorkbenchSynchronizedMediaElementOptions) {
  const [blocked, setBlocked] = useState(false);
  const blockedRef = useRef(false);
  const playbackStartedRef = useRef(false);
  const lastPlayAttemptSignatureRef = useRef<string | null>(null);
  const lastSourceTimingKeyRef = useRef<string | null>(null);
  const lastSyncSnapshotRef = useRef<{
    currentTimeMs: number;
    playbackRate: number;
    sourceTimingKey: string;
    status: TimelinePreviewTransportContext["status"];
  } | null>(null);
  const localTimeMs = getTimelineWorkbenchMediaLocalTimeMs(item, currentTimeMs, {
    sourceStartMs,
    sourceEndMs,
  });
  const active = currentTimeMs >= item.startMs && currentTimeMs <= getTimelineEditorItemEndMs(item);
  const setBlockedState = (nextBlocked: boolean) => {
    blockedRef.current = nextBlocked;
    setBlocked(nextBlocked);
  };

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
    const sourceTimingKey = `${item.id}:${item.startMs}:${item.durationMs}:${sourceStartMs}:${
      sourceEndMs ?? ""
    }`;
    const previousSnapshot = lastSyncSnapshotRef.current;
    const sourceTimingChanged = lastSourceTimingKeyRef.current !== sourceTimingKey;
    const rememberSyncSnapshot = () => {
      lastSyncSnapshotRef.current = {
        currentTimeMs,
        playbackRate: transport.playbackRate,
        sourceTimingKey,
        status: transport.status,
      };
    };
    const seek = () => {
      if (Number.isFinite(localTimeSeconds)) {
        element.currentTime = localTimeSeconds;
      }
    };
    const resetPlaybackAttempt = () => {
      playbackStartedRef.current = false;
      lastPlayAttemptSignatureRef.current = null;
    };

    if (sourceTimingChanged) {
      lastSourceTimingKeyRef.current = sourceTimingKey;
      resetPlaybackAttempt();
      setBlockedState(false);
    }

    if (!active) {
      pauseTimelineWorkbenchMediaElement(element, playbackStartedRef.current);
      seek();
      resetPlaybackAttempt();
      setBlockedState(false);
      rememberSyncSnapshot();
      return;
    }

    if (transport.status !== "playing") {
      pauseTimelineWorkbenchMediaElement(
        element,
        playbackStartedRef.current || element.dataset["playState"] === "playing",
      );
      if (driftMs > pausedSeekThresholdMs) {
        seek();
      }
      resetPlaybackAttempt();
      setBlockedState(false);
      rememberSyncSnapshot();
      return;
    }

    if (transport.playbackRate < 0) {
      pauseTimelineWorkbenchMediaElement(element, playbackStartedRef.current);
      seek();
      resetPlaybackAttempt();
      setBlockedState(false);
      rememberSyncSnapshot();
      return;
    }

    element.playbackRate = transport.playbackRate;
    const previousTimelineDeltaMs = previousSnapshot
      ? currentTimeMs - previousSnapshot.currentTimeMs
      : 0;
    const shouldSeekForwardPlayback =
      sourceTimingChanged ||
      !playbackStartedRef.current ||
      previousSnapshot?.status !== "playing" ||
      previousSnapshot?.playbackRate !== transport.playbackRate ||
      previousSnapshot?.sourceTimingKey !== sourceTimingKey ||
      previousTimelineDeltaMs < -pausedSeekThresholdMs ||
      Math.abs(previousTimelineDeltaMs) > forwardPlaybackSeekThresholdMs;

    if (
      driftMs > startupSeekThresholdMs &&
      (shouldSeekForwardPlayback || driftMs > forwardPlaybackSeekThresholdMs)
    ) {
      seek();
      setBlockedState(false);
    }

    const playAttemptSignature = `${sourceTimingKey}:${transport.playbackRate}:${Math.floor(
      localTimeMs / 250,
    )}`;
    const shouldStartPlayback = element.paused || blockedRef.current || !playbackStartedRef.current;

    if (!shouldStartPlayback || lastPlayAttemptSignatureRef.current === playAttemptSignature) {
      rememberSyncSnapshot();
      return;
    }

    lastPlayAttemptSignatureRef.current = playAttemptSignature;
    playbackStartedRef.current = true;

    let playResult: ReturnType<HTMLMediaElement["play"]> | undefined;

    try {
      playResult = element.play();
    } catch {
      playbackStartedRef.current = false;
      setBlockedState(true);
      rememberSyncSnapshot();
      return;
    }

    if (playResult && typeof playResult.catch === "function") {
      playResult
        .then(() => {
          setBlockedState(false);
        })
        .catch(() => {
          playbackStartedRef.current = false;
          setBlockedState(true);
        });
    } else {
      setBlockedState(false);
    }

    rememberSyncSnapshot();
  }, [
    active,
    currentTimeMs,
    elementRef,
    localTimeMs,
    sourceEndMs,
    sourceStartMs,
    transport.playbackRate,
    transport.status,
  ]);

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

function pauseTimelineWorkbenchMediaElement(element: HTMLMediaElement, force = false) {
  if (!force && element.paused) {
    return;
  }

  try {
    element.pause();
    if (element.dataset["playState"]) {
      element.dataset["playState"] = "paused";
    }
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
  const resolvedUpperBoundMs = options.sourceEndMs ?? lowerBoundMs + item.durationMs;
  const upperBoundMs = Math.max(lowerBoundMs, resolvedUpperBoundMs);

  return Math.max(lowerBoundMs, Math.min(upperBoundMs, unclampedLocalTimeMs));
}
