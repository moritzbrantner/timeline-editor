import {
  addTimelineEditorMarker,
  addTimelineEditorTrack,
  closeTimelineEditorGap,
  duplicateTimelineEditorItems,
  getTimelineEditorGroupedItemIds,
  groupTimelineEditorItems,
  insertTimelineEditorItem,
  moveTimelineEditorItems,
  normalizeTimelineEditorDocument,
  normalizeTimelineEditorTracks,
  removeTimelineEditorTrack,
  removeTimelineEditorItems,
  resizeTimelineEditorItem,
  rippleDeleteTimelineEditorItems,
  splitTimelineEditorItems,
  ungroupTimelineEditorItems,
} from "./operations";
import {
  type TimelineEditorDocument,
  type TimelineEditorItem,
  type TimelineEditorMarker,
  type TimelineEditorOperationOptions,
  type TimelineEditorSelection,
  type TimelineEditorTrack,
} from "./types";

export type TimelineEditorCommand<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
> =
  | { type: "select"; selection: TimelineEditorSelection }
  | { type: "delete-selection" }
  | { type: "move-items"; itemIds: string[]; deltaMs: number; trackDelta?: number }
  | { type: "resize-item"; itemId: string; edge: "start" | "end"; timeMs: number }
  | { type: "split-items"; itemIds: string[]; timeMs: number }
  | { type: "duplicate-selection" }
  | { type: "group-selection"; groupId?: string; label?: string }
  | { type: "ungroup-selection" }
  | { type: "ripple-delete"; itemIds: string[] }
  | { type: "close-gap"; trackId: string; startMs: number; endMs: number }
  | {
      type: "add-track";
      track: Omit<TimelineEditorTrack<TTrackData, TItemData>, "items"> &
        Partial<Pick<TimelineEditorTrack<TTrackData, TItemData>, "items">>;
    }
  | { type: "remove-track"; trackId: string }
  | { type: "add-marker"; marker: TimelineEditorMarker }
  | { type: "insert-item"; item: TimelineEditorItem<TItemData> }
  | { type: "update-item"; itemId: string; patch: Partial<TimelineEditorItem<TItemData>> };

export type TimelineEditorCommandResult<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
> = {
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>;
  selection: TimelineEditorSelection;
  label: string;
  changed: boolean;
};

export function applyTimelineEditorCommand<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  selection: TimelineEditorSelection,
  command: TimelineEditorCommand<TTrackData, TItemData>,
  options: TimelineEditorOperationOptions = {},
): TimelineEditorCommandResult<TTrackData, TItemData, TGroupData> {
  if (command.type === "select") {
    return {
      document,
      selection: command.selection,
      label: "Select items",
      changed: !areSelectionsEqual(selection, command.selection),
    };
  }

  if (command.type === "delete-selection") {
    const tracks = removeTimelineEditorItems(
      document.tracks,
      getTimelineEditorGroupedItemIds(document, selection.itemIds),
      options,
    );
    return result(document, tracks, { itemIds: [] }, "Delete selection");
  }

  if (command.type === "move-items") {
    const tracks = moveTimelineEditorItems(
      document.tracks,
      getTimelineEditorGroupedItemIds(document, command.itemIds),
      command.deltaMs,
      {
        ...options,
        trackDelta: command.trackDelta,
      },
    );
    return result(document, tracks, selection, `Move ${command.itemIds.length} items`);
  }

  if (command.type === "resize-item") {
    const found = document.tracks
      .flatMap((track) => track.items)
      .find((item) => item.id === command.itemId);
    const tracks = found
      ? resizeTimelineEditorItem(
          document.tracks,
          command.edge === "start"
            ? { itemId: command.itemId, edge: "start", startMs: command.timeMs }
            : {
                itemId: command.itemId,
                edge: "end",
                durationMs: command.timeMs - found.startMs,
              },
          options,
        )
      : document.tracks;
    return result(document, tracks, selection, "Resize item");
  }

  if (command.type === "split-items") {
    const tracks = splitTimelineEditorItems(
      document.tracks,
      getTimelineEditorGroupedItemIds(document, command.itemIds),
      command.timeMs,
      options,
    );
    return result(document, tracks, selection, "Split item");
  }

  if (command.type === "duplicate-selection") {
    const tracks = duplicateTimelineEditorItems(
      document.tracks,
      getTimelineEditorGroupedItemIds(document, selection.itemIds),
      options,
    );
    return result(document, tracks, selection, "Duplicate selection");
  }

  if (command.type === "group-selection") {
    const nextDocument = groupTimelineEditorItems(
      document,
      selection.itemIds,
      { id: command.groupId, label: command.label },
      options,
    );

    return {
      document: nextDocument,
      selection,
      label: "Group selection",
      changed: nextDocument !== document,
    };
  }

  if (command.type === "ungroup-selection") {
    const nextDocument = ungroupTimelineEditorItems(document, selection.itemIds, options);

    return {
      document: nextDocument,
      selection,
      label: "Ungroup selection",
      changed: nextDocument !== document,
    };
  }

  if (command.type === "ripple-delete") {
    const tracks = rippleDeleteTimelineEditorItems(
      document.tracks,
      getTimelineEditorGroupedItemIds(document, command.itemIds),
    );
    return result(document, tracks, { itemIds: [] }, "Ripple delete");
  }

  if (command.type === "add-track") {
    const nextDocument = addTimelineEditorTrack(document, command.track, options);
    return documentResult(document, nextDocument, selection, "Add timeline");
  }

  if (command.type === "remove-track") {
    const nextDocument = removeTimelineEditorTrack(document, command.trackId, options);
    return documentResult(document, nextDocument, { itemIds: [] }, "Remove timeline");
  }

  if (command.type === "add-marker") {
    const nextDocument = addTimelineEditorMarker(document, command.marker, options);
    return documentResult(document, nextDocument, selection, "Add marker");
  }

  if (command.type === "insert-item") {
    const tracks = insertTimelineEditorItem(document.tracks, command.item, options);
    return result(
      document,
      tracks,
      tracks === document.tracks
        ? selection
        : { itemIds: [command.item.id], anchorItemId: command.item.id },
      "Insert item",
    );
  }

  if (command.type === "update-item") {
    const found = document.tracks
      .flatMap((track) => track.items.map((item) => ({ item, track })))
      .find(({ item }) => item.id === command.itemId);

    if (!found || found.item.locked || found.track.locked) {
      return { document, selection, label: "Update item", changed: false };
    }

    const tracks = normalizeTimelineEditorTracks(
      document.tracks.map((track) =>
        track.id === found.track.id
          ? {
              ...track,
              items: track.items.map((item) =>
                item.id === found.item.id ? { ...item, ...command.patch } : item,
              ),
            }
          : track,
      ),
      options,
    );
    return result(document, tracks, selection, "Update item");
  }

  const tracks = closeTimelineEditorGap(
    document.tracks,
    command.trackId,
    command.startMs,
    command.endMs,
    options,
  );
  return result(document, tracks, selection, "Close gap");
}

function documentResult<TTrackData, TItemData, TGroupData>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  nextDocument: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  selection: TimelineEditorSelection,
  label: string,
): TimelineEditorCommandResult<TTrackData, TItemData, TGroupData> {
  return {
    document: nextDocument,
    selection,
    label,
    changed: nextDocument !== document,
  };
}

function result<TTrackData, TItemData, TGroupData>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  tracks: TimelineEditorDocument<TTrackData, TItemData, TGroupData>["tracks"],
  selection: TimelineEditorSelection,
  label: string,
): TimelineEditorCommandResult<TTrackData, TItemData, TGroupData> {
  const changed = tracks !== document.tracks;

  return {
    document: changed ? normalizeTimelineEditorDocument({ ...document, tracks }) : document,
    selection,
    label,
    changed,
  };
}

function areSelectionsEqual(left: TimelineEditorSelection, right: TimelineEditorSelection) {
  if (left.anchorItemId !== right.anchorItemId || left.itemIds.length !== right.itemIds.length) {
    return false;
  }

  return left.itemIds.every((itemId, index) => itemId === right.itemIds[index]);
}
