import { type TimelineEditorCommand } from "../../commands";
import {
  createTimelineEditorClipboard,
  type TimelineEditorClipboard,
  type TimelineEditorDocument,
  type TimelineEditorOperationOptions,
  type TimelineEditorSelection,
} from "../../core";
import {
  applyTimelineEditorCommandWithHistory,
  redoTimelineEditorHistory,
  type TimelineEditorHistory,
  undoTimelineEditorHistory,
} from "../../history";

export type TimelineWorkbenchCommandDispatcher<TTrackData, TItemData> = {
  runCommand: (
    command: TimelineEditorCommand<TTrackData, TItemData>,
    commandSelection?: TimelineEditorSelection,
  ) => void;
  runTransientCommand: (
    command: TimelineEditorCommand<TTrackData, TItemData>,
    commandSelection?: TimelineEditorSelection,
  ) => void;
  undoHistory: () => boolean;
  redoHistory: () => boolean;
  copyItems: (itemIds?: string[]) => void;
};

export type TimelineWorkbenchCommandDispatcherOptions<TTrackData, TItemData> = {
  document: TimelineEditorDocument<TTrackData, TItemData>;
  selection: TimelineEditorSelection;
  history: TimelineEditorHistory<TTrackData, TItemData>;
  clipboard: TimelineEditorClipboard<TItemData> | undefined;
  durationMs: number;
  editPolicy: TimelineEditorOperationOptions["editPolicy"];
  snapMs: number;
  minItemDurationMs: number | undefined;
  commitHistory: (history: TimelineEditorHistory<TTrackData, TItemData>) => void;
  commitClipboard: (clipboard: TimelineEditorClipboard<TItemData> | undefined) => void;
  commitSelection: (selection: TimelineEditorSelection) => void;
  onDocumentChange: ((document: TimelineEditorDocument<TTrackData, TItemData>) => void) | undefined;
};

export function createTimelineWorkbenchCommandDispatcher<TTrackData, TItemData>(
  options: TimelineWorkbenchCommandDispatcherOptions<TTrackData, TItemData>,
): TimelineWorkbenchCommandDispatcher<TTrackData, TItemData> {
  const commandOptions = {
    durationMs: options.durationMs,
    editPolicy: options.editPolicy,
    snapMs: options.snapMs,
    minItemDurationMs: options.minItemDurationMs,
  } satisfies TimelineEditorOperationOptions;

  const applyCommandResult = (
    command: TimelineEditorCommand<TTrackData, TItemData>,
    commandSelection: TimelineEditorSelection,
    mode: "committed" | "transient",
  ) => {
    const result = applyTimelineEditorCommandWithHistory(
      options.document,
      commandSelection,
      options.history,
      command,
      commandOptions,
    );

    if (mode === "committed" || result.changed) {
      options.commitHistory(result.history);
    }

    if ("clipboard" in result) {
      options.commitClipboard(result.clipboard);
    }

    if (result.changed) {
      options.onDocumentChange?.(result.document);
    }

    if (!areTimelineWorkbenchSelectionsEqual(result.selection, options.selection)) {
      options.commitSelection(result.selection);
    }
  };

  return {
    runCommand: (command, commandSelection = options.selection) => {
      applyCommandResult(command, commandSelection, "committed");
    },
    runTransientCommand: (command, commandSelection = options.selection) => {
      applyCommandResult(command, commandSelection, "transient");
    },
    undoHistory: () => {
      const undo = undoTimelineEditorHistory(options.history);
      options.commitHistory(undo.history);

      if (!undo.document) {
        return false;
      }

      options.onDocumentChange?.(undo.document);

      if (undo.selection) {
        options.commitSelection(undo.selection);
      }

      return true;
    },
    redoHistory: () => {
      const redo = redoTimelineEditorHistory(options.history);
      options.commitHistory(redo.history);

      if (!redo.document) {
        return false;
      }

      options.onDocumentChange?.(redo.document);

      if (redo.selection) {
        options.commitSelection(redo.selection);
      }

      return true;
    },
    copyItems: (itemIds = options.selection.itemIds) => {
      if (itemIds.length === 0) {
        return;
      }

      const nextClipboard = createTimelineEditorClipboard(options.document.tracks, itemIds);
      options.commitClipboard(nextClipboard);
    },
  };
}

function areTimelineWorkbenchSelectionsEqual(
  left: TimelineEditorSelection,
  right: TimelineEditorSelection,
) {
  if (
    left.anchorItemId !== right.anchorItemId ||
    left.itemIds.length !== right.itemIds.length ||
    (left.trackIds?.length ?? 0) !== (right.trackIds?.length ?? 0) ||
    (left.markerIds?.length ?? 0) !== (right.markerIds?.length ?? 0) ||
    left.range?.startMs !== right.range?.startMs ||
    left.range?.endMs !== right.range?.endMs
  ) {
    return false;
  }

  return (
    left.itemIds.every((itemId, index) => itemId === right.itemIds[index]) &&
    (left.trackIds ?? []).every((trackId, index) => trackId === right.trackIds?.[index]) &&
    (left.markerIds ?? []).every((markerId, index) => markerId === right.markerIds?.[index])
  );
}
