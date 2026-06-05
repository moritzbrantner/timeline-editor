import type { KeyboardEvent } from "react";
import {
  getEditorHotkeyFromKeyboardEvent,
  isEditorEditableTarget,
  matchesEditorHotkey,
} from "@moritzbrantner/editor-core/hotkeys";

import type { TimelineEditorSnapOptions } from "../../types";
import { defaultTimelineEditorSnapMs } from "../../types";

export const matchesHotkey = (event: KeyboardEvent, hotkey: string) =>
  hotkey.trim() ? matchesEditorHotkey(event, hotkey) : false;

export const isKeyboardEventFromEditableTarget = (event: KeyboardEvent) =>
  isEditorEditableTarget(event.target);

export function getHotkeyFromKeyboardEvent(event: KeyboardEvent) {
  if (
    event.key === "Tab" ||
    event.key === "Control" ||
    event.key === "Meta" ||
    event.key === "Shift" ||
    event.key === "Alt"
  ) {
    return undefined;
  }

  return getEditorHotkeyFromKeyboardEvent(event);
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
