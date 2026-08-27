"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";

import { getTimelineEditorItemEndMs, type TimelineEditorItem } from "../../core";
import type {
  TimelinePreviewTransportContext,
  TimelineWorkbenchMediaErrorCode,
  TimelineWorkbenchMediaStatus,
} from "./types";

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

type TimelineWorkbenchMediaClock = {
  seekGeneration: number;
  register: (clockId: string, priority?: number) => void;
  unregister: (clockId: string) => void;
  isOwner: (clockId: string) => boolean;
  reportTime: (clockId: string, timelineTimeMs: number) => void;
};

type TimelinePreviewTransportContextWithMediaClock = TimelinePreviewTransportContext & {
  mediaClock?: TimelineWorkbenchMediaClock;
};

type TimelineVideoFrameMetadata = {
  mediaTime: number;
};

type TimelineVideoFrameElement = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (now: number, metadata: TimelineVideoFrameMetadata) => void,
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

const followerPlaybackSeekThresholdMs = 500;
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
  const lastMediaSeekGenerationRef = useRef<number | null>(null);
  const lastSyncSnapshotRef = useRef<{
    playbackRate: number;
    sourceTimingKey: string;
    status: TimelinePreviewTransportContext["status"];
  } | null>(null);
  const mediaClockInstanceId = useId();
  const mediaClockId = `${item.id}:${mediaClockInstanceId}`;
  const mediaClock = (transport as TimelinePreviewTransportContextWithMediaClock).mediaClock;
  const localTimeMs = getTimelineWorkbenchMediaLocalTimeMs(item, currentTimeMs, {
    sourceStartMs,
    sourceEndMs,
  });
  const itemEndMs = getTimelineEditorItemEndMs(item);
  const active = currentTimeMs >= item.startMs && currentTimeMs <= itemEndMs;
  const activeForForwardPlayback =
    currentTimeMs >= item.startMs && currentTimeMs < itemEndMs && transport.playbackRate > 0;
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

    if (
      !element ||
      !mediaClock ||
      !activeForForwardPlayback ||
      transport.status !== "playing"
    ) {
      return;
    }

    const priority = element.tagName === "VIDEO" ? 100 : 50;
    mediaClock.register(mediaClockId, priority);

    return () => mediaClock.unregister(mediaClockId);
  }, [
    activeForForwardPlayback,
    elementRef,
    mediaClock,
    mediaClockId,
    transport.status,
  ]);

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
    const mediaSeekGeneration = mediaClock?.seekGeneration ?? 0;
    const explicitSeekRequested = lastMediaSeekGenerationRef.current !== mediaSeekGeneration;
    const rememberSyncSnapshot = () => {
      lastSyncSnapshotRef.current = {
        playbackRate: transport.playbackRate,
        sourceTimingKey,
        status: transport.status,
      };
      lastMediaSeekGenerationRef.current = mediaSeekGeneration;
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
    const mediaOwnsPlayback = mediaClock?.isOwner(mediaClockId) ?? false;
    const shouldSeekForPlaybackTransition =
      sourceTimingChanged ||
      !playbackStartedRef.current ||
      previousSnapshot?.status !== "playing" ||
      previousSnapshot?.playbackRate !== transport.playbackRate ||
      previousSnapshot?.sourceTimingKey !== sourceTimingKey ||
      explicitSeekRequested;

    if (
      (shouldSeekForPlaybackTransition && driftMs > startupSeekThresholdMs) ||
      (!mediaOwnsPlayback && driftMs > followerPlaybackSeekThresholdMs)
    ) {
      seek();
      setBlockedState(false);
    }

    const playAttemptSignature = `${sourceTimingKey}:${transport.playbackRate}:${mediaSeekGeneration}:${Math.floor(
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
    mediaClock,
    mediaClockId,
    sourceEndMs,
    sourceStartMs,
    transport.playbackRate,
    transport.status,
  ]);

  useEffect(() => {
    const element = elementRef.current;

    if (
      !element ||
      !mediaClock ||
      !activeForForwardPlayback ||
      transport.status !== "playing"
    ) {
      return;
    }

    let animationFrame: number | null = null;
    let videoFrameCallback: number | null = null;
    let cancelled = false;
    const reportMediaTime = (mediaTimeSeconds: number) => {
      if (cancelled || element.paused || !mediaClock.isOwner(mediaClockId)) {
        return;
      }

      mediaClock.reportTime(
        mediaClockId,
        getTimelineWorkbenchTimelineTimeMsFromMedia(item, mediaTimeSeconds, {
          sourceStartMs,
          sourceEndMs,
        }),
      );
    };
    const video =
      element.tagName === "VIDEO" ? (element as TimelineVideoFrameElement) : undefined;

    if (video?.requestVideoFrameCallback) {
      const requestVideoFrameCallback = video.requestVideoFrameCallback.bind(video);
      const scheduleVideoFrame = () => {
        videoFrameCallback = requestVideoFrameCallback((_now, metadata) => {
          if (cancelled) {
            return;
          }

          reportMediaTime(metadata.mediaTime);
          scheduleVideoFrame();
        });
      };

      scheduleVideoFrame();
    } else {
      const stopAnimationFrame = () => {
        if (animationFrame !== null) {
          cancelAnimationFrame(animationFrame);
          animationFrame = null;
        }
      };
      const tick = () => {
        if (cancelled || element.paused) {
          animationFrame = null;
          return;
        }

        reportMediaTime(element.currentTime);
        animationFrame = requestAnimationFrame(tick);
      };
      const startAnimationFrame = () => {
        if (animationFrame === null) {
          animationFrame = requestAnimationFrame(tick);
        }
      };
      const reportTimeUpdate = () => reportMediaTime(element.currentTime);

      element.addEventListener("playing", startAnimationFrame);
      element.addEventListener("pause", stopAnimationFrame);
      element.addEventListener("timeupdate", reportTimeUpdate);

      return () => {
        cancelled = true;
        stopAnimationFrame();
        element.removeEventListener("playing", startAnimationFrame);
        element.removeEventListener("pause", stopAnimationFrame);
        element.removeEventListener("timeupdate", reportTimeUpdate);
      };
    }

    return () => {
      cancelled = true;
      if (videoFrameCallback !== null) {
        video?.cancelVideoFrameCallback?.(videoFrameCallback);
      }
    };
  }, [
    activeForForwardPlayback,
    elementRef,
    item,
    mediaClock,
    mediaClockId,
    sourceEndMs,
    sourceStartMs,
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

export function useTimelineWorkbenchMediaElementStatus(
  elementRef: RefObject<HTMLMediaElement | null>,
  sourceUri?: string,
): {
  status: TimelineWorkbenchMediaStatus;
  errorCode?: TimelineWorkbenchMediaErrorCode;
} {
  const [state, setState] = useState<{
    status: TimelineWorkbenchMediaStatus;
    errorCode?: TimelineWorkbenchMediaErrorCode;
  }>(() => (sourceUri ? { status: "loading" } : { status: "idle", errorCode: "no-source" }));

  useEffect(() => {
    const element = elementRef.current;

    if (!sourceUri) {
      setState({ status: "idle", errorCode: "no-source" });
      return;
    }

    if (!element) {
      setState({ status: "loading" });
      return;
    }

    const resolveStatus = (): TimelineWorkbenchMediaStatus => {
      if (element.error) {
        return "error";
      }

      if (element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        return element.paused ? "ready" : "playing";
      }

      if (element.readyState >= HTMLMediaElement.HAVE_METADATA) {
        return "metadata-ready";
      }

      return "loading";
    };
    const updateStatus = () => {
      setState({ status: resolveStatus() });
    };
    const updatePaused = () => {
      setState({ status: "paused" });
    };
    const updateLoading = () => {
      setState({ status: "loading" });
    };
    const updateStalled = () => {
      setState({ status: "stalled", errorCode: "stalled" });
    };
    const updateError = () => {
      setState({ status: "error", errorCode: getTimelineWorkbenchMediaErrorCode(element) });
    };
    const stalledTimeout = globalThis.setTimeout(() => {
      if (element.readyState < HTMLMediaElement.HAVE_METADATA) {
        updateStalled();
      }
    }, 4_000);

    updateStatus();
    element.addEventListener("loadstart", updateLoading);
    element.addEventListener("loadedmetadata", updateStatus);
    element.addEventListener("loadeddata", updateStatus);
    element.addEventListener("canplay", updateStatus);
    element.addEventListener("playing", updateStatus);
    element.addEventListener("pause", updatePaused);
    element.addEventListener("waiting", updateStalled);
    element.addEventListener("stalled", updateStalled);
    element.addEventListener("error", updateError);
    if (element.readyState < HTMLMediaElement.HAVE_METADATA) {
      try {
        element.load();
      } catch {
        // Some test DOMs and browser edge cases expose media elements without a usable load method.
      }
    }

    return () => {
      globalThis.clearTimeout(stalledTimeout);
      element.removeEventListener("loadstart", updateLoading);
      element.removeEventListener("loadedmetadata", updateStatus);
      element.removeEventListener("loadeddata", updateStatus);
      element.removeEventListener("canplay", updateStatus);
      element.removeEventListener("playing", updateStatus);
      element.removeEventListener("pause", updatePaused);
      element.removeEventListener("waiting", updateStalled);
      element.removeEventListener("stalled", updateStalled);
      element.removeEventListener("error", updateError);
    };
  }, [elementRef, sourceUri]);

  return state;
}

function getTimelineWorkbenchMediaErrorCode(
  element: HTMLMediaElement,
): TimelineWorkbenchMediaErrorCode {
  switch (element.error?.code) {
    case 4:
      return "unsupported-source";
    case 3:
      return "decode-failed";
    case 2:
    case 1:
    default:
      return "load-failed";
  }
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

function getTimelineWorkbenchTimelineTimeMsFromMedia(
  item: TimelineEditorItem<unknown>,
  mediaTimeSeconds: number,
  options: { sourceStartMs: number; sourceEndMs?: number },
) {
  const lowerBoundMs = Math.max(0, options.sourceStartMs);
  const resolvedUpperBoundMs = options.sourceEndMs ?? lowerBoundMs + item.durationMs;
  const upperBoundMs = Math.max(lowerBoundMs, resolvedUpperBoundMs);
  const finiteMediaTimeMs = Number.isFinite(mediaTimeSeconds)
    ? mediaTimeSeconds * 1_000
    : lowerBoundMs;
  const mediaTimeMs = Math.max(lowerBoundMs, Math.min(upperBoundMs, finiteMediaTimeMs));
  const timelineTimeMs = item.startMs + mediaTimeMs - lowerBoundMs;

  return Math.max(item.startMs, Math.min(getTimelineEditorItemEndMs(item), timelineTimeMs));
}
