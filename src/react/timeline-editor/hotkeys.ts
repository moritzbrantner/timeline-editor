import type { KeyboardEvent } from "react";

import type { TimelineEditorSnapOptions } from "../../types";
import { defaultTimelineEditorSnapMs } from "../../types";

export function matchesHotkey(event: KeyboardEvent, hotkey: string) {
  if (!hotkey.trim()) {
    return false;
  }

  const parts = hotkey.split("+").map((part) => part.toLowerCase());
  const expectedKey = parts.at(-1);
  const needsMod = parts.includes("mod");
  const needsShift = parts.includes("shift");
  const needsAlt = parts.includes("alt");
  const needsCtrl = parts.includes("ctrl") || parts.includes("control");
  const needsMeta = parts.includes("cmd") || parts.includes("command") || parts.includes("meta");
  const key = event.key.toLowerCase();

  if (needsMod && !(event.metaKey || event.ctrlKey)) {
    return false;
  }

  if (!needsMod) {
    if (needsCtrl !== event.ctrlKey) {
      return false;
    }

    if (needsMeta !== event.metaKey) {
      return false;
    }
  }

  if (needsShift !== event.shiftKey) {
    return false;
  }

  if (needsAlt !== event.altKey) {
    return false;
  }

  return expectedKey === key || (expectedKey === "delete" && event.key === "Delete");
}

export function isKeyboardEventFromEditableTarget(event: KeyboardEvent) {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "SELECT" ||
    target.tagName === "TEXTAREA"
  );
}

export function getHotkeyFromKeyboardEvent(event: KeyboardEvent) {
  if (event.key === "Tab") {
    return undefined;
  }

  const key = normalizeHotkeyKey(event.key);

  if (!key) {
    return undefined;
  }

  const parts = [
    event.shiftKey ? "Shift" : undefined,
    event.metaKey || event.ctrlKey ? "Mod" : undefined,
    event.altKey ? "Alt" : undefined,
    key,
  ].filter((part): part is string => Boolean(part));

  return parts.join("+");
}

function normalizeHotkeyKey(key: string) {
  if (key === " " || key === "Spacebar") {
    return "Space";
  }

  if (key === "Control" || key === "Meta" || key === "Shift" || key === "Alt") {
    return undefined;
  }

  if (key.length === 1) {
    return key.toUpperCase();
  }

  return key;
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
