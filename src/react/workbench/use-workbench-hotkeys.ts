import type { KeyboardEvent } from "react";

import type { TimelineEditorTool } from "../../core";
import { isKeyboardEventFromEditableTarget, matchesHotkey } from "../timeline-editor/hotkeys";
import { defaultTimelineWorkbenchHotkeys } from "./toolbar";

type TimelineWorkbenchHotkeys = typeof defaultTimelineWorkbenchHotkeys;

export function getTimelineWorkbenchToolHotkey(
  event: KeyboardEvent,
  hotkeys: TimelineWorkbenchHotkeys,
): TimelineEditorTool | undefined {
  const entries: Array<[keyof TimelineWorkbenchHotkeys, TimelineEditorTool]> = [
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

export type TimelineWorkbenchKeyboardCommands = {
  toggleTransport: () => void;
  stopTransport: () => void;
  shuttleForward: () => void;
  shuttleBackward: () => void;
  toggleLoop: () => void;
  undo: () => void;
  redo: () => void;
  deleteItems: () => void;
  copyItems: () => void;
  cutItems: () => void;
  pasteItems: () => void;
  splitItems: () => void;
  duplicateItems: () => void;
  groupItems: () => void;
  ungroupItems: () => void;
  addMarker: () => void;
  clearSelection: () => void;
  stepFrame: (direction: -1 | 1) => void;
  jumpStart: () => void;
  jumpEnd: () => void;
  jumpToAdjacentMarker: (direction: -1 | 1) => void;
  jumpToAdjacentItemEdge: (direction: -1 | 1) => void;
  setTool: (tool: TimelineEditorTool) => void;
};

/** Runs the first command bound to the key. Binding order decides which wins when hotkeys collide. */
export function handleTimelineWorkbenchKeyDown(
  event: KeyboardEvent,
  hotkeys: TimelineWorkbenchHotkeys,
  readOnly: boolean,
  commands: TimelineWorkbenchKeyboardCommands,
) {
  const matches = (hotkeyId: keyof TimelineWorkbenchHotkeys) => {
    const hotkey = hotkeys[hotkeyId];
    return hotkey ? matchesHotkey(event, hotkey) : false;
  };

  if (event.defaultPrevented || isKeyboardEventFromEditableTarget(event)) {
    return;
  }

  if (readOnly && !matches("copy")) {
    return;
  }

  const transportBindings: Array<[keyof TimelineWorkbenchHotkeys, () => void]> = readOnly
    ? []
    : [
        ["playPause", commands.toggleTransport],
        ["stopPlayback", commands.stopTransport],
        ["shuttleForward", commands.shuttleForward],
        ["shuttleBackward", commands.shuttleBackward],
        ["toggleLoop", commands.toggleLoop],
      ];
  const bindings: Array<[boolean, () => void]> = [
    ...transportBindings.map(([hotkeyId, run]): [boolean, () => void] => [matches(hotkeyId), run]),
    [matches("undo"), commands.undo],
    [matches("redo") || matches("redoAlternate"), commands.redo],
    [matches("delete") || event.key === "Backspace", commands.deleteItems],
    [matches("copy"), commands.copyItems],
    [matches("cut"), commands.cutItems],
    [matches("paste"), commands.pasteItems],
    [matches("split"), commands.splitItems],
    [matches("duplicate"), commands.duplicateItems],
    [matches("group"), commands.groupItems],
    [matches("ungroup"), commands.ungroupItems],
    [matches("addMarker"), commands.addMarker],
    [matches("clearSelection"), commands.clearSelection],
    [matches("previousFrame"), () => commands.stepFrame(-1)],
    [matches("nextFrame"), () => commands.stepFrame(1)],
    [matches("jumpStart"), commands.jumpStart],
    [matches("jumpEnd"), commands.jumpEnd],
    [matches("previousMarker"), () => commands.jumpToAdjacentMarker(-1)],
    [matches("nextMarker"), () => commands.jumpToAdjacentMarker(1)],
    [matches("previousEdge"), () => commands.jumpToAdjacentItemEdge(-1)],
    [matches("nextEdge"), () => commands.jumpToAdjacentItemEdge(1)],
  ];
  const binding = bindings.find(([matched]) => matched);

  if (binding) {
    event.preventDefault();
    binding[1]();
    return;
  }

  const nextTool = getTimelineWorkbenchToolHotkey(event, hotkeys);

  if (nextTool) {
    event.preventDefault();
    commands.setTool(nextTool);
  }
}
