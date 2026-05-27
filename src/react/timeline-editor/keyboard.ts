import type { KeyboardEvent } from "react";

import { applyTimelineEditorCommand } from "../../commands";
import type {
  TimelineEditorDocument,
  TimelineEditorSelection,
  TimelineEditorViewport,
} from "../../types";
import { getNextTimelineEditorPixelsPerSecond } from "./viewport";
import { matchesHotkey } from "./hotkeys";
import { isTrackLockedByGroup } from "./selection";
import type { TimelineEditorHotkeys } from "./types";

type TimelineEditorKeyboardOptions<TTrackData extends Record<string, unknown>, TItemData> = {
  document: TimelineEditorDocument<TTrackData, TItemData>;
  durationMs: number;
  hotkeys: TimelineEditorHotkeys;
  nudgeMs: number;
  readOnly: boolean;
  selection: TimelineEditorSelection;
  viewport: TimelineEditorViewport;
  onDocumentChange: (document: TimelineEditorDocument<TTrackData, TItemData>) => void;
  onSelectionChange: (selection: TimelineEditorSelection) => void;
  onViewportChange?: (viewport: TimelineEditorViewport) => void;
};

export function useTimelineEditorKeyboard<TTrackData extends Record<string, unknown>, TItemData>({
  document,
  durationMs,
  hotkeys,
  nudgeMs,
  readOnly,
  selection,
  viewport,
  onDocumentChange,
  onSelectionChange,
  onViewportChange,
}: TimelineEditorKeyboardOptions<TTrackData, TItemData>) {
  return (event: KeyboardEvent<HTMLDivElement>) => {
    if (readOnly) {
      return;
    }

    if (matchesHotkey(event, hotkeys.selectAll)) {
      event.preventDefault();
      onSelectionChange({
        itemIds: document.tracks
          .filter((track) => !isTrackLockedByGroup(document, track))
          .flatMap((track) => track.items.filter((item) => !item.locked).map((item) => item.id)),
      });
      return;
    }

    if (matchesHotkey(event, hotkeys.delete) || event.key === "Backspace") {
      event.preventDefault();
      const result = applyTimelineEditorCommand(
        document,
        selection,
        { type: "delete-selection" },
        { durationMs },
      );
      onDocumentChange(result.document);
      onSelectionChange(result.selection);
      return;
    }

    if (matchesHotkey(event, hotkeys.nudgeLeft) || matchesHotkey(event, hotkeys.nudgeRight)) {
      event.preventDefault();
      const direction = matchesHotkey(event, hotkeys.nudgeLeft) ? -1 : 1;
      const result = applyTimelineEditorCommand(
        document,
        selection,
        {
          type: "move-items",
          itemIds: selection.itemIds,
          deltaMs: direction * nudgeMs,
        },
        { durationMs, snapMs: nudgeMs },
      );
      onDocumentChange(result.document);
      return;
    }

    if (matchesHotkey(event, hotkeys.zoomIn) || matchesHotkey(event, hotkeys.zoomOut)) {
      event.preventDefault();
      const direction = matchesHotkey(event, hotkeys.zoomIn) ? 1 : -1;
      onViewportChange?.({
        ...viewport,
        pixelsPerSecond: getNextTimelineEditorPixelsPerSecond(viewport.pixelsPerSecond, direction),
      });
    }
  };
}
