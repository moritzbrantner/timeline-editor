import type { KeyboardEvent } from "react";

import type { TimelineEditorSnapOptions } from "../../types";
import { defaultTimelineEditorSnapMs } from "../../types";

export function matchesHotkey(event: KeyboardEvent, hotkey: string) {
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

export function getTimelineEditorSnapIntervalMs(snap: TimelineEditorSnapOptions) {
  const intervalTarget = snap.targets.find((target) => target.type === "interval");

  return intervalTarget?.type === "interval" ? intervalTarget.intervalMs : undefined;
}

export function getTimelineEditorNudgeMs(
  frameDurationMs: number | undefined,
  snap: TimelineEditorSnapOptions,
) {
  return frameDurationMs ?? getTimelineEditorSnapIntervalMs(snap) ?? defaultTimelineEditorSnapMs;
}
