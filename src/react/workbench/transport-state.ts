import type { TimelineEditorSelection, TimelineEditorTimeRange } from "../../core";
import type { TimelineWorkbenchPlaybackRate, TimelineWorkbenchTransportState } from "./types";
import { normalizeTimelineWorkbenchRange } from "./use-workbench-state";

const defaultResolvedTransportState = {
  status: "paused",
  playbackRate: 1,
  loop: false,
} satisfies TimelineWorkbenchTransportState;

export function resolveTimelineWorkbenchTransportState(
  state: Partial<TimelineWorkbenchTransportState> | undefined,
): TimelineWorkbenchTransportState {
  return {
    status: state?.status === "playing" ? "playing" : defaultResolvedTransportState.status,
    playbackRate: isTimelineWorkbenchPlaybackRate(state?.playbackRate)
      ? state.playbackRate
      : defaultResolvedTransportState.playbackRate,
    loop: state?.loop ?? defaultResolvedTransportState.loop,
  };
}

export function getTimelineWorkbenchTransportLoopRange(
  loop: boolean,
  selectionRange: TimelineEditorSelection["range"],
  durationMs: number,
) {
  if (!loop || durationMs <= 0) {
    return undefined;
  }

  const selectedRange = normalizeTimelineWorkbenchRange(selectionRange);

  if (selectedRange && selectedRange.endMs - selectedRange.startMs >= 1) {
    const clampedRange = {
      startMs: Math.max(0, Math.min(durationMs, selectedRange.startMs)),
      endMs: Math.max(0, Math.min(durationMs, selectedRange.endMs)),
    };

    if (clampedRange.endMs - clampedRange.startMs >= 1) {
      return clampedRange;
    }
  }

  return { startMs: 0, endMs: durationMs };
}

export function resolveTimelineWorkbenchPlaybackTime(
  nextTimeMs: number,
  durationMs: number,
  playbackRate: TimelineWorkbenchPlaybackRate,
  loopRange: TimelineEditorTimeRange | undefined,
) {
  if (durationMs <= 0) {
    return { timeMs: 0, ended: true };
  }

  if (!loopRange) {
    if (playbackRate >= 0 && nextTimeMs >= durationMs) {
      return { timeMs: durationMs, ended: true };
    }

    if (playbackRate < 0 && nextTimeMs <= 0) {
      return { timeMs: 0, ended: true };
    }

    return { timeMs: Math.max(0, Math.min(durationMs, nextTimeMs)), ended: false };
  }

  const startMs = Math.max(0, Math.min(durationMs, loopRange.startMs));
  const endMs = Math.max(startMs, Math.min(durationMs, loopRange.endMs));
  const spanMs = endMs - startMs;

  if (spanMs < 1) {
    return { timeMs: Math.max(0, Math.min(durationMs, nextTimeMs)), ended: false };
  }

  if (nextTimeMs >= endMs) {
    return { timeMs: startMs + positiveModulo(nextTimeMs - endMs, spanMs), ended: false };
  }

  if (nextTimeMs <= startMs) {
    return { timeMs: endMs - positiveModulo(startMs - nextTimeMs, spanMs), ended: false };
  }

  return { timeMs: nextTimeMs, ended: false };
}

function isTimelineWorkbenchPlaybackRate(
  playbackRate: unknown,
): playbackRate is TimelineWorkbenchPlaybackRate {
  return (
    playbackRate === -4 ||
    playbackRate === -2 ||
    playbackRate === -1 ||
    playbackRate === 1 ||
    playbackRate === 2 ||
    playbackRate === 4
  );
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}
