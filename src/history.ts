import { applyTimelineEditorCommand, type TimelineEditorCommand } from "./commands";
import {
  type TimelineEditorDocument,
  type TimelineEditorOperationOptions,
  type TimelineEditorSelection,
} from "./types";

export type TimelineEditorTransaction<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
> = {
  id: string;
  label: string;
  before: TimelineEditorDocument<TTrackData, TItemData, TGroupData>;
  after: TimelineEditorDocument<TTrackData, TItemData, TGroupData>;
  selectionBefore?: TimelineEditorSelection;
  selectionAfter?: TimelineEditorSelection;
};

export type TimelineEditorHistory<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
> = {
  undoStack: Array<TimelineEditorTransaction<TTrackData, TItemData, TGroupData>>;
  redoStack: Array<TimelineEditorTransaction<TTrackData, TItemData, TGroupData>>;
};

export function createTimelineEditorHistory(): TimelineEditorHistory {
  return {
    undoStack: [],
    redoStack: [],
  };
}

export function applyTimelineEditorCommandWithHistory<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  selection: TimelineEditorSelection,
  history: TimelineEditorHistory<TTrackData, TItemData, TGroupData>,
  command: TimelineEditorCommand<TTrackData, TItemData>,
  options: TimelineEditorOperationOptions = {},
) {
  const result = applyTimelineEditorCommand(document, selection, command, options);

  if (!result.changed) {
    return { ...result, history };
  }

  const transaction = {
    id: `transaction-${Date.now()}-${history.undoStack.length + 1}`,
    label: result.label,
    before: document,
    after: result.document,
    selectionBefore: selection,
    selectionAfter: result.selection,
  };

  return {
    ...result,
    history: {
      undoStack: [...history.undoStack, transaction],
      redoStack: [],
    },
  };
}

export function undoTimelineEditorHistory<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(history: TimelineEditorHistory<TTrackData, TItemData, TGroupData>) {
  const transaction = history.undoStack.at(-1);

  if (!transaction) {
    return { history };
  }

  return {
    document: transaction.before,
    selection: transaction.selectionBefore ?? { itemIds: [] },
    transaction,
    history: {
      undoStack: history.undoStack.slice(0, -1),
      redoStack: [...history.redoStack, transaction],
    },
  };
}

export function redoTimelineEditorHistory<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(history: TimelineEditorHistory<TTrackData, TItemData, TGroupData>) {
  const transaction = history.redoStack.at(-1);

  if (!transaction) {
    return { history };
  }

  return {
    document: transaction.after,
    selection: transaction.selectionAfter ?? { itemIds: [] },
    transaction,
    history: {
      undoStack: [...history.undoStack, transaction],
      redoStack: history.redoStack.slice(0, -1),
    },
  };
}
