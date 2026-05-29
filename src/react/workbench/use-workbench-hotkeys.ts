import type { KeyboardEvent } from "react";

import type { TimelineEditorTool } from "../../core";
import { matchesHotkey } from "../timeline-editor/hotkeys";
import { defaultTimelineWorkbenchHotkeys } from "./toolbar";

export function getTimelineWorkbenchToolHotkey(
  event: KeyboardEvent,
  hotkeys: typeof defaultTimelineWorkbenchHotkeys,
): TimelineEditorTool | undefined {
  const entries: Array<[keyof typeof defaultTimelineWorkbenchHotkeys, TimelineEditorTool]> = [
    ["toolSelect", "select"],
    ["toolBlade", "blade"],
    ["toolTrim", "trim"],
    ["toolRippleTrim", "ripple-trim"],
    ["toolPan", "pan"],
  ];

  return entries.find(([hotkeyId]) => {
    const hotkey = hotkeys[hotkeyId];
    return hotkey ? matchesHotkey(event, hotkey) : false;
  })?.[1];
}
