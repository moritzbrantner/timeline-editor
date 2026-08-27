import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getTimelineEditorItemEndMs,
  setTimelineEditorCurrentTime,
  type TimelineEditorDocument,
  type TimelineEditorItem,
  type TimelineEditorSelection,
  type TimelineEditorTimeRange,
} from "../../core";
import {
  getTimelineWorkbenchTransportLoopRange,
  resolveTimelineWorkbenchPlaybackTime,
  resolveTimelineWorkbenchTransportState,
} from "./transport-state";
import type {
  TimelinePreviewTransportContext,
  TimelineWorkbenchPlaybackRate,
  TimelineWorkbenchTransportChangeReason,
  TimelineWorkbenchTransportState,
  TimelineWorkbenchTransportStateChangeContext,
} from "./types";
import { isTimelineWorkbenchCurrentTimeOnlyChange } from "./use-workbench-state";

type TimelineWorkbenchMediaClock = {
  seekGeneration: number;
  register: (clockId: string, priority?: number) => void;
  unregister: (clockId: string) => void;
  isOwner: (clockId: string) => boolean;
  reportTime: (clockId: string, timelineTimeMs: number) => void;
};

type TimelinePreviewTransportContextWithMediaClock = TimelinePreviewTransportContext & {
  mediaClock: TimelineWorkbenchMediaClock;
};

type TimelineWorkbenchMediaClockCandidate = {
  priority: number;
  order: number;
};

export type TimelineWorkbenchTransportController = {
  resolvedTransportState: TimelineWorkbenchTransportState;
  transportLoopRange: TimelineEditorTimeRange | undefined;
  previewTransportContext: TimelinePreviewTransportContext;
  commitTransportState: (
    nextState: TimelineWorkbenchTransportState,
    reason: TimelineWorkbenchTransportChangeReason,
  ) => void;
  pauseTransport: (reason?: TimelineWorkbenchTransportChangeReason) => void;
  playTransport: (
    rate?: TimelineWorkbenchPlaybackRate,
    reason?: TimelineWorkbenchTransportChangeReason,
  ) => void;
  toggleTransport: () => void;
  stopTransport: () => void;
  shuttleForward: () => void;
  shuttleBackward: () => void;
  toggleLoop: () => void;
};

export type UseTimelineWorkbenchTransportOptions<TTrackData, TItemData> = {
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
  currentTimeMs: number;
  readOnly: boolean;
  selection: TimelineEditorSelection;
  transportState?: TimelineWorkbenchTransportState;
  defaultTransportState?: Partial<TimelineWorkbenchTransportState>;
  onTransportStateChange?: (
    state: TimelineWorkbenchTransportState,
    context: TimelineWorkbenchTransportStateChangeContext,
  ) => void;
  onCurrentTimeChange?: (currentTimeMs: number) => void;
  commitDocument: (nextDocument: TimelineEditorDocument<TTrackData, TItemData>) => void;
};

const internalClockTimeToleranceMs = 2;

export function useTimelineWorkbenchTransport<TTrackData, TItemData>({
  document,
  durationMs,
  currentTimeMs,
  readOnly,
  selection,
  transportState,
  defaultTransportState,
  onTransportStateChange,
  onCurrentTimeChange,
  commitDocument,
}: UseTimelineWorkbenchTransportOptions<
  TTrackData,
  TItemData
>): TimelineWorkbenchTransportController {
  const [internalTransportState, setInternalTransportState] =
    useState<TimelineWorkbenchTransportState>(() =>
      resolveTimelineWorkbenchTransportState(defaultTransportState),
    );
  const [mediaSeekGeneration, setMediaSeekGeneration] = useState(0);
  const previewAnimationFrameRef = useRef<number | null>(null);
  const previewLastFrameTimestampRef = useRef<number | null>(null);
  const documentRef = useRef(document);
  const durationMsRef = useRef(durationMs);
  const onCurrentTimeChangeRef = useRef(onCurrentTimeChange);
  const commitDocumentRef = useRef(commitDocument);
  const resolvedSelectionRef = useRef(selection);
  const resolvedTransportState = transportState ?? internalTransportState;
  const transportStateRef = useRef(resolvedTransportState);
  const onTransportStateChangeRef = useRef(onTransportStateChange);
  const previousCurrentTimeRef = useRef(currentTimeMs);
  const recentInternalClockTimesRef = useRef<number[]>([]);
  const mediaClockCandidatesRef = useRef(new Map<string, TimelineWorkbenchMediaClockCandidate>());
  const mediaClockOwnerIdRef = useRef<string | null>(null);
  const mediaClockHasReportedRef = useRef(false);
  const nextMediaClockOrderRef = useRef(0);

  useEffect(() => {
    documentRef.current = document;
    durationMsRef.current = durationMs;
    onCurrentTimeChangeRef.current = onCurrentTimeChange;
    commitDocumentRef.current = commitDocument;
    resolvedSelectionRef.current = selection;
    transportStateRef.current = resolvedTransportState;
    onTransportStateChangeRef.current = onTransportStateChange;
  });

  const cancelPreviewAnimationFrame = useCallback(() => {
    if (previewAnimationFrameRef.current !== null) {
      cancelAnimationFrame(previewAnimationFrameRef.current);
      previewAnimationFrameRef.current = null;
    }

    previewLastFrameTimestampRef.current = null;
  }, []);

  const rememberInternalClockTime = useCallback((timeMs: number) => {
    const recentTimes = recentInternalClockTimesRef.current;
    recentTimes.push(timeMs);
    if (recentTimes.length > 32) {
      recentTimes.splice(0, recentTimes.length - 32);
    }
  }, []);

  const commitPreviewCurrentTime = useCallback(
    (timeMs: number) => {
      const currentDocument = documentRef.current;
      const nextDocument = setTimelineEditorCurrentTime(currentDocument, timeMs, {
        durationMs: durationMsRef.current,
        snapMs: 0,
      });
      const resolvedTimeMs = nextDocument.currentTimeMs ?? 0;

      if (Math.abs((currentDocument.currentTimeMs ?? 0) - resolvedTimeMs) <= Number.EPSILON) {
        return;
      }

      rememberInternalClockTime(resolvedTimeMs);
      onCurrentTimeChangeRef.current?.(resolvedTimeMs);
      commitDocumentRef.current(nextDocument);
    },
    [rememberInternalClockTime],
  );

  const commitTransportState = useCallback(
    (
      nextState: TimelineWorkbenchTransportState,
      reason: TimelineWorkbenchTransportChangeReason,
    ) => {
      const resolvedNextState = resolveTimelineWorkbenchTransportState(nextState);

      transportStateRef.current = resolvedNextState;
      if (transportState === undefined) {
        setInternalTransportState(resolvedNextState);
      }

      onTransportStateChangeRef.current?.(resolvedNextState, {
        reason,
        currentTimeMs: documentRef.current.currentTimeMs ?? 0,
        durationMs: durationMsRef.current,
      });
    },
    [transportState],
  );

  const recomputeMediaClockOwner = useCallback(() => {
    let nextOwnerId: string | null = null;
    let nextOwner: TimelineWorkbenchMediaClockCandidate | undefined;

    for (const [clockId, candidate] of mediaClockCandidatesRef.current) {
      if (
        !nextOwner ||
        candidate.priority > nextOwner.priority ||
        (candidate.priority === nextOwner.priority && candidate.order < nextOwner.order)
      ) {
        nextOwnerId = clockId;
        nextOwner = candidate;
      }
    }

    if (mediaClockOwnerIdRef.current !== nextOwnerId) {
      mediaClockOwnerIdRef.current = nextOwnerId;
      mediaClockHasReportedRef.current = false;
    }
  }, []);

  const registerMediaClock = useCallback(
    (clockId: string, priority = 0) => {
      const existing = mediaClockCandidatesRef.current.get(clockId);
      mediaClockCandidatesRef.current.set(clockId, {
        priority,
        order: existing?.order ?? nextMediaClockOrderRef.current++,
      });
      recomputeMediaClockOwner();
    },
    [recomputeMediaClockOwner],
  );

  const unregisterMediaClock = useCallback(
    (clockId: string) => {
      mediaClockCandidatesRef.current.delete(clockId);
      recomputeMediaClockOwner();
    },
    [recomputeMediaClockOwner],
  );

  const isMediaClockOwner = useCallback(
    (clockId: string) => mediaClockOwnerIdRef.current === clockId,
    [],
  );

  const pauseTransport = useCallback(
    (reason: TimelineWorkbenchTransportChangeReason = "pause") => {
      commitTransportState({ ...transportStateRef.current, status: "paused" }, reason);
      cancelPreviewAnimationFrame();
    },
    [cancelPreviewAnimationFrame, commitTransportState],
  );

  const playTransport = useCallback(
    (
      rate: TimelineWorkbenchPlaybackRate = 1,
      reason: TimelineWorkbenchTransportChangeReason = "play",
    ) => {
      if (readOnly || durationMsRef.current <= 0) {
        return;
      }

      const duration = durationMsRef.current;
      const currentTime = documentRef.current.currentTimeMs ?? 0;
      const loopRange = getTimelineWorkbenchTransportLoopRange(
        transportStateRef.current.loop,
        resolvedSelectionRef.current.range,
        duration,
      );

      if (loopRange) {
        if (rate > 0 && currentTime >= loopRange.endMs) {
          commitPreviewCurrentTime(loopRange.startMs);
          setMediaSeekGeneration((generation) => generation + 1);
        } else if (rate < 0 && currentTime <= loopRange.startMs) {
          commitPreviewCurrentTime(loopRange.endMs);
        }
      } else if (rate > 0 && currentTime >= duration) {
        commitPreviewCurrentTime(0);
        setMediaSeekGeneration((generation) => generation + 1);
      } else if (rate < 0 && currentTime <= 0) {
        commitPreviewCurrentTime(duration);
      }

      previewLastFrameTimestampRef.current = null;
      commitTransportState(
        {
          ...transportStateRef.current,
          status: "playing",
          playbackRate: rate,
        },
        reason,
      );
    },
    [commitPreviewCurrentTime, commitTransportState, readOnly],
  );

  const toggleTransport = useCallback(() => {
    if (transportStateRef.current.status === "playing") {
      pauseTransport("toggle-play");
    } else {
      playTransport(1, "toggle-play");
    }
  }, [pauseTransport, playTransport]);

  const stopTransport = useCallback(() => {
    commitTransportState(
      { ...transportStateRef.current, status: "paused", playbackRate: 1 },
      "stop",
    );
    cancelPreviewAnimationFrame();
  }, [cancelPreviewAnimationFrame, commitTransportState]);

  const shuttleForward = useCallback(() => {
    const currentState = transportStateRef.current;
    const nextRate: TimelineWorkbenchPlaybackRate =
      currentState.status === "paused" || currentState.playbackRate < 0
        ? 1
        : currentState.playbackRate === 1
          ? 2
          : 4;

    playTransport(nextRate, "shuttle-forward");
  }, [playTransport]);

  const shuttleBackward = useCallback(() => {
    const currentState = transportStateRef.current;
    const nextRate: TimelineWorkbenchPlaybackRate =
      currentState.status === "paused" || currentState.playbackRate > 0
        ? -1
        : currentState.playbackRate === -1
          ? -2
          : -4;

    playTransport(nextRate, "shuttle-backward");
  }, [playTransport]);

  const toggleLoop = useCallback(() => {
    if (readOnly || durationMsRef.current <= 0) {
      return;
    }

    commitTransportState(
      { ...transportStateRef.current, loop: !transportStateRef.current.loop },
      "loop-toggle",
    );
  }, [commitTransportState, readOnly]);

  const reportMediaTime = useCallback(
    (clockId: string, timelineTimeMs: number) => {
      const state = transportStateRef.current;

      if (
        mediaClockOwnerIdRef.current !== clockId ||
        state.status !== "playing" ||
        state.playbackRate <= 0 ||
        !Number.isFinite(timelineTimeMs)
      ) {
        return;
      }

      mediaClockHasReportedRef.current = true;
      const duration = durationMsRef.current;
      const loopRange = getTimelineWorkbenchTransportLoopRange(
        state.loop,
        resolvedSelectionRef.current.range,
        duration,
      );
      const resolvedTime = resolveTimelineWorkbenchPlaybackTime(
        timelineTimeMs,
        duration,
        state.playbackRate,
        loopRange,
      );
      const wrapped = Math.abs(resolvedTime.timeMs - timelineTimeMs) > internalClockTimeToleranceMs;

      commitPreviewCurrentTime(resolvedTime.timeMs);

      if (wrapped) {
        setMediaSeekGeneration((generation) => generation + 1);
      }

      if (resolvedTime.ended) {
        commitTransportState({ ...state, status: "paused" }, "ended");
        cancelPreviewAnimationFrame();
      }
    },
    [cancelPreviewAnimationFrame, commitPreviewCurrentTime, commitTransportState],
  );

  useEffect(() => {
    const previousCurrentTime = previousCurrentTimeRef.current;
    previousCurrentTimeRef.current = currentTimeMs;

    if (Math.abs(previousCurrentTime - currentTimeMs) <= Number.EPSILON) {
      return;
    }

    const recentTimes = recentInternalClockTimesRef.current;
    const internalTimeIndex = recentTimes.findIndex(
      (timeMs) => Math.abs(timeMs - currentTimeMs) <= internalClockTimeToleranceMs,
    );

    if (internalTimeIndex >= 0) {
      recentTimes.splice(0, internalTimeIndex + 1);
      return;
    }

    recentTimes.length = 0;
    if (
      transportStateRef.current.status === "playing" &&
      transportStateRef.current.playbackRate > 0
    ) {
      setMediaSeekGeneration((generation) => generation + 1);
    }
  }, [currentTimeMs]);

  useEffect(() => {
    if (resolvedTransportState.status !== "playing") {
      cancelPreviewAnimationFrame();
      return;
    }

    if (durationMs <= 0) {
      pauseTransport("ended");
      return;
    }

    const tick = (timestamp: number) => {
      const lastTimestamp = previewLastFrameTimestampRef.current;
      previewLastFrameTimestampRef.current = timestamp;

      if (lastTimestamp !== null) {
        const duration = durationMsRef.current;
        const state = transportStateRef.current;

        if (duration <= 0) {
          pauseTransport("ended");
          return;
        }

        const mediaOwnsForwardPlayback =
          state.playbackRate > 0 &&
          mediaClockOwnerIdRef.current !== null &&
          mediaClockHasReportedRef.current;

        if (!mediaOwnsForwardPlayback) {
          const currentTime = documentRef.current.currentTimeMs ?? 0;
          const elapsedMs = timestamp - lastTimestamp;
          const nextTime = currentTime + elapsedMs * state.playbackRate;
          const loopRange = getTimelineWorkbenchTransportLoopRange(
            state.loop,
            resolvedSelectionRef.current.range,
            duration,
          );
          const resolvedTime = resolveTimelineWorkbenchPlaybackTime(
            nextTime,
            duration,
            state.playbackRate,
            loopRange,
          );

          commitPreviewCurrentTime(resolvedTime.timeMs);

          if (resolvedTime.ended) {
            commitTransportState({ ...state, status: "paused" }, "ended");
            previewAnimationFrameRef.current = null;
            previewLastFrameTimestampRef.current = null;
            return;
          }
        }
      }

      previewAnimationFrameRef.current = requestAnimationFrame(tick);
    };

    previewAnimationFrameRef.current = requestAnimationFrame(tick);

    return cancelPreviewAnimationFrame;
  }, [
    cancelPreviewAnimationFrame,
    commitPreviewCurrentTime,
    commitTransportState,
    durationMs,
    pauseTransport,
    resolvedTransportState.status,
  ]);

  useEffect(() => {
    if (resolvedTransportState.status === "playing" && readOnly) {
      pauseTransport("read-only");
    }
  }, [pauseTransport, readOnly, resolvedTransportState.status]);

  useEffect(() => {
    if (resolvedTransportState.status === "playing" && durationMs <= 0) {
      pauseTransport("ended");
    }
  }, [durationMs, pauseTransport, resolvedTransportState.status]);

  const previousDocumentRef = useRef(document);

  useEffect(() => {
    const previousDocument = previousDocumentRef.current;
    previousDocumentRef.current = document;

    if (
      resolvedTransportState.status === "playing" &&
      previousDocument !== document &&
      !isTimelineWorkbenchCurrentTimeOnlyChange(previousDocument, document)
    ) {
      pauseTransport("document-change");
    }
  }, [document, pauseTransport, resolvedTransportState.status]);

  const transportLoopRange = getTimelineWorkbenchTransportLoopRange(
    resolvedTransportState.loop,
    selection.range,
    durationMs,
  );
  const mediaClock = useMemo<TimelineWorkbenchMediaClock>(
    () => ({
      seekGeneration: mediaSeekGeneration,
      register: registerMediaClock,
      unregister: unregisterMediaClock,
      isOwner: isMediaClockOwner,
      reportTime: reportMediaTime,
    }),
    [
      isMediaClockOwner,
      mediaSeekGeneration,
      registerMediaClock,
      reportMediaTime,
      unregisterMediaClock,
    ],
  );
  const previewTransportContext = useMemo(
    () =>
      ({
        ...resolvedTransportState,
        currentTimeMs,
        durationMs,
        isPlaying: resolvedTransportState.status === "playing",
        getItemLocalTimeMs: (item: TimelineEditorItem<unknown>) => currentTimeMs - item.startMs,
        isItemActive: (item: TimelineEditorItem<unknown>) =>
          item.startMs <= currentTimeMs && getTimelineEditorItemEndMs(item) >= currentTimeMs,
        mediaClock,
      }) as TimelinePreviewTransportContextWithMediaClock,
    [currentTimeMs, durationMs, mediaClock, resolvedTransportState],
  );

  return {
    resolvedTransportState,
    transportLoopRange,
    previewTransportContext,
    commitTransportState,
    pauseTransport,
    playTransport,
    toggleTransport,
    stopTransport,
    shuttleForward,
    shuttleBackward,
    toggleLoop,
  };
}
