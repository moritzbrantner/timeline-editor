import {
  createEditorTransactionHistory,
  pushEditorTransactionHistory,
  redoEditorTransactionHistory,
  undoEditorTransactionHistory,
  type EditorTransaction,
  type EditorTransactionHistory,
} from "@moritzbrantner/editor-core/history";

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
> = EditorTransaction<
  TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  TimelineEditorSelection
> & {
  label: string;
};

export type TimelineEditorHistory<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
> = EditorTransactionHistory<
  TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  TimelineEditorSelection
> & {
  undoStack: Array<TimelineEditorTransaction<TTrackData, TItemData, TGroupData>>;
  redoStack: Array<TimelineEditorTransaction<TTrackData, TItemData, TGroupData>>;
};

export function createTimelineEditorHistory(): TimelineEditorHistory {
  return createEditorTransactionHistory() as TimelineEditorHistory;
}

export function applyTimelineEditorCommandWithHistory<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  selection: TimelineEditorSelection,
  history: TimelineEditorHistory<TTrackData, TItemData, TGroupData>,
  command: TimelineEditorCommand<TTrackData, TItemData, TGroupData>,
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
    history: pushEditorTransactionHistory(history, transaction, {
      limit: Number.MAX_SAFE_INTEGER,
    }) as TimelineEditorHistory<TTrackData, TItemData, TGroupData>,
  };
}

export function undoTimelineEditorHistory<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(history: TimelineEditorHistory<TTrackData, TItemData, TGroupData>) {
  const result = undoEditorTransactionHistory(history, { itemIds: [] });

  return {
    ...result,
    history: result.history as TimelineEditorHistory<TTrackData, TItemData, TGroupData>,
    transaction: result.transaction as
      | TimelineEditorTransaction<TTrackData, TItemData, TGroupData>
      | undefined,
  };
}

export function redoTimelineEditorHistory<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(history: TimelineEditorHistory<TTrackData, TItemData, TGroupData>) {
  const result = redoEditorTransactionHistory(history, { itemIds: [] });

  return {
    ...result,
    history: result.history as TimelineEditorHistory<TTrackData, TItemData, TGroupData>,
    transaction: result.transaction as
      | TimelineEditorTransaction<TTrackData, TItemData, TGroupData>
      | undefined,
  };
}
