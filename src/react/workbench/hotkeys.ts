import { defaultTimelineEditorHotkeys } from "../timeline-editor/constants";
import type { TimelineEditorHotkeys } from "../timeline-editor/types";

export type TimelineWorkbenchHotkeyId = keyof TimelineEditorHotkeys;

export type TimelineWorkbenchHotkeyDefinition = {
  id: TimelineWorkbenchHotkeyId;
  label: string;
};

export type TimelineWorkbenchHotkeyGroup = {
  id: string;
  label: string;
  hotkeys: TimelineWorkbenchHotkeyDefinition[];
};

export const defaultTimelineWorkbenchHotkeys: TimelineEditorHotkeys = {
  ...defaultTimelineEditorHotkeys,
  addMarker: "M",
  duplicate: "D",
  group: "Mod+G",
  nextFrame: ".",
  previousFrame: ",",
  split: "S",
  toolBlade: "B",
  toolPan: "H",
  toolRippleTrim: "R",
  toolSelect: "V",
  toolTrim: "T",
  playPause: "Space",
  stopPlayback: "K",
  shuttleBackward: "J",
  shuttleForward: "L",
  toggleLoop: "Shift+L",
  ungroup: "Shift+Mod+G",
};

export const timelineWorkbenchHotkeyGroups: TimelineWorkbenchHotkeyGroup[] = [
  {
    id: "editing",
    label: "Editing",
    hotkeys: [
      { id: "undo", label: "Undo" },
      { id: "redo", label: "Redo" },
      { id: "redoAlternate", label: "Redo alternate" },
      { id: "copy", label: "Copy" },
      { id: "cut", label: "Cut" },
      { id: "paste", label: "Paste" },
      { id: "delete", label: "Delete" },
      { id: "split", label: "Split" },
      { id: "duplicate", label: "Duplicate" },
      { id: "group", label: "Group" },
      { id: "ungroup", label: "Ungroup" },
      { id: "addMarker", label: "Add marker" },
    ],
  },
  {
    id: "navigation",
    label: "Navigation",
    hotkeys: [
      { id: "selectAll", label: "Select all" },
      { id: "clearSelection", label: "Clear selection" },
      { id: "nudgeLeft", label: "Nudge left" },
      { id: "nudgeRight", label: "Nudge right" },
      { id: "previousFrame", label: "Previous frame" },
      { id: "nextFrame", label: "Next frame" },
      { id: "jumpStart", label: "Jump to start" },
      { id: "jumpEnd", label: "Jump to end" },
      { id: "previousMarker", label: "Previous marker" },
      { id: "nextMarker", label: "Next marker" },
      { id: "previousEdge", label: "Previous item edge" },
      { id: "nextEdge", label: "Next item edge" },
    ],
  },
  {
    id: "transport",
    label: "Transport",
    hotkeys: [
      { id: "playPause", label: "Play / pause" },
      { id: "stopPlayback", label: "Stop playback" },
      { id: "shuttleBackward", label: "Shuttle backward" },
      { id: "shuttleForward", label: "Shuttle forward" },
      { id: "toggleLoop", label: "Loop playback" },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    hotkeys: [
      { id: "toolSelect", label: "Select tool" },
      { id: "toolBlade", label: "Blade tool" },
      { id: "toolTrim", label: "Trim tool" },
      { id: "toolRippleTrim", label: "Ripple trim tool" },
      { id: "toolPan", label: "Pan tool" },
      { id: "zoomIn", label: "Zoom in" },
      { id: "zoomOut", label: "Zoom out" },
    ],
  },
];
