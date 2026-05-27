import {
  addTimelineEditorTrackGroup,
  addTimelineEditorMarker,
  addTimelineEditorTrack,
  canPlaceTimelineEditorItemOnTrack,
  closeTimelineEditorGap,
  createTimelineEditorClipboard,
  duplicateTimelineEditorItems,
  getTimelineEditorGroupedItemIds,
  groupTimelineEditorItems,
  insertTimelineEditorGap,
  insertTimelineEditorItem,
  moveTimelineEditorTrack,
  moveTimelineEditorItems,
  normalizeTimelineEditorDocument,
  normalizeTimelineEditorTracks,
  pasteTimelineEditorClipboard,
  removeTimelineEditorMarker,
  removeTimelineEditorRange,
  removeTimelineEditorTrackGroup,
  removeTimelineEditorTrack,
  removeTimelineEditorItems,
  resizeTimelineEditorItem,
  rippleDeleteTimelineEditorItems,
  splitTimelineEditorItems,
  trimTimelineEditorItem,
  ungroupTimelineEditorItems,
  updateTimelineEditorMarker,
  updateTimelineEditorTrack,
  updateTimelineEditorTrackGroup,
} from "./operations";
import {
  type TimelineEditorClipboard,
  type TimelineEditorDocument,
  type TimelineEditorItem,
  type TimelineEditorMarker,
  type TimelineEditorOperationOptions,
  type TimelineEditorSelection,
  type TimelineEditorTrack,
  type TimelineEditorTrackGroup,
} from "./types";

export type TimelineEditorCommand<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
> =
  | { type: "select"; selection: TimelineEditorSelection }
  | { type: "select-all" }
  | { type: "clear-selection" }
  | { type: "invert-selection" }
  | { type: "select-track-items"; trackId: string }
  | { type: "set-range"; range?: { startMs: number; endMs: number } }
  | { type: "copy-selection" }
  | { type: "cut-selection" }
  | {
      type: "paste-items";
      clipboard: TimelineEditorClipboard<TItemData>;
      timeMs: number;
      trackId?: string;
      createId?: (itemId: string, existingIds: ReadonlySet<string>) => string;
    }
  | { type: "delete-selection" }
  | { type: "delete-range"; range?: { startMs: number; endMs: number } }
  | { type: "move-items"; itemIds: string[]; deltaMs: number; trackDelta?: number }
  | { type: "resize-item"; itemId: string; edge: "start" | "end"; timeMs: number }
  | {
      type: "trim-item";
      itemId: string;
      edge: "start" | "end";
      timeMs: number;
      mode?: "normal" | "ripple" | "roll";
    }
  | { type: "split-items"; itemIds: string[]; timeMs: number }
  | { type: "split-at-pointer"; itemIds: string[]; timeMs: number }
  | { type: "duplicate-selection" }
  | { type: "group-selection"; groupId?: string; label?: string }
  | { type: "ungroup-selection" }
  | { type: "ripple-delete"; itemIds: string[] }
  | { type: "close-gap"; trackId: string; startMs: number; endMs: number }
  | { type: "insert-gap"; trackId: string; startMs: number; durationMs: number }
  | {
      type: "add-track";
      track: Omit<TimelineEditorTrack<TTrackData, TItemData>, "items"> &
        Partial<Pick<TimelineEditorTrack<TTrackData, TItemData>, "items">>;
    }
  | {
      type: "update-track";
      trackId: string;
      patch: Partial<Omit<TimelineEditorTrack<TTrackData, TItemData>, "id" | "items">>;
    }
  | { type: "move-track"; trackId: string; toIndex: number }
  | { type: "remove-track"; trackId: string }
  | { type: "add-marker"; marker: TimelineEditorMarker }
  | { type: "update-marker"; markerId: string; patch: Partial<TimelineEditorMarker> }
  | { type: "remove-marker"; markerId: string }
  | { type: "add-track-group"; group: TimelineEditorTrackGroup<TGroupData> }
  | {
      type: "update-track-group";
      groupId: string;
      patch: Partial<Omit<TimelineEditorTrackGroup<TGroupData>, "id">>;
    }
  | { type: "remove-track-group"; groupId: string }
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
  clipboard?: TimelineEditorClipboard<TItemData>;
};

export function applyTimelineEditorCommand<
  TTrackData = Record<string, unknown>,
  TItemData = Record<string, unknown>,
  TGroupData = Record<string, unknown>,
>(
  document: TimelineEditorDocument<TTrackData, TItemData, TGroupData>,
  selection: TimelineEditorSelection,
  command: TimelineEditorCommand<TTrackData, TItemData, TGroupData>,
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

  if (command.type === "select-all") {
    const itemIds = document.tracks
      .filter((track) => !track.locked)
      .flatMap((track) => track.items.filter((item) => !item.locked).map((item) => item.id));
    const nextSelection = { itemIds, anchorItemId: itemIds[0] };

    return {
      document,
      selection: nextSelection,
      label: "Select all",
      changed: !areSelectionsEqual(selection, nextSelection),
    };
  }

  if (command.type === "clear-selection") {
    const nextSelection = { itemIds: [] };

    return {
      document,
      selection: nextSelection,
      label: "Clear selection",
      changed: !areSelectionsEqual(selection, nextSelection),
    };
  }

  if (command.type === "invert-selection") {
    const selectedIds = new Set(selection.itemIds);
    const itemIds = document.tracks
      .filter((track) => !track.locked)
      .flatMap((track) =>
        track.items
          .filter((item) => !item.locked && !selectedIds.has(item.id))
          .map((item) => item.id),
      );
    const nextSelection = { itemIds, anchorItemId: itemIds[0] };

    return {
      document,
      selection: nextSelection,
      label: "Invert selection",
      changed: !areSelectionsEqual(selection, nextSelection),
    };
  }

  if (command.type === "select-track-items") {
    const track = document.tracks.find((candidate) => candidate.id === command.trackId);
    const itemIds =
      track && !track.locked
        ? track.items.filter((item) => !item.locked).map((item) => item.id)
        : [];
    const nextSelection = {
      itemIds,
      anchorItemId: itemIds[0],
      trackIds: track ? [track.id] : undefined,
    };

    return {
      document,
      selection: nextSelection,
      label: "Select track items",
      changed: !areSelectionsEqual(selection, nextSelection),
    };
  }

  if (command.type === "set-range") {
    const nextSelection = { ...selection, range: command.range };

    return {
      document,
      selection: nextSelection,
      label: "Set range",
      changed: !areSelectionsEqual(selection, nextSelection),
    };
  }

  if (command.type === "copy-selection") {
    return {
      document,
      selection,
      label: "Copy selection",
      changed: false,
      clipboard: createTimelineEditorClipboard(
        document.tracks,
        getTimelineEditorGroupedItemIds(document, selection.itemIds),
      ),
    };
  }

  if (command.type === "cut-selection") {
    const groupedIds = getTimelineEditorGroupedItemIds(document, selection.itemIds);
    const clipboard = createTimelineEditorClipboard(document.tracks, groupedIds);
    const tracks = removeTimelineEditorItems(document.tracks, groupedIds, options);

    return { ...result(document, tracks, { itemIds: [] }, "Cut selection"), clipboard };
  }

  if (command.type === "paste-items") {
    const pasted = pasteTimelineEditorClipboard(
      document.tracks,
      command.clipboard,
      { timeMs: command.timeMs, trackId: command.trackId, createId: command.createId },
      options,
    );

    return result(
      document,
      pasted.tracks,
      pasted.itemIds.length > 0
        ? { itemIds: pasted.itemIds, anchorItemId: pasted.itemIds[0] }
        : selection,
      "Paste items",
    );
  }

  if (command.type === "delete-selection") {
    const tracks = removeTimelineEditorItems(
      document.tracks,
      getTimelineEditorGroupedItemIds(document, selection.itemIds),
      options,
    );
    return result(document, tracks, { itemIds: [] }, "Delete selection");
  }

  if (command.type === "delete-range") {
    const range = command.range ?? selection.range;
    const tracks = range
      ? removeTimelineEditorRange(document.tracks, range, options)
      : document.tracks;

    return result(document, tracks, { ...selection, range: undefined }, "Delete range");
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

  if (command.type === "trim-item") {
    const tracks = trimTimelineEditorItem(
      document.tracks,
      command.itemId,
      command.edge,
      command.timeMs,
      command.mode,
      options,
    );
    return result(document, tracks, selection, "Trim item");
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

  if (command.type === "split-at-pointer") {
    const tracks = splitTimelineEditorItems(
      document.tracks,
      getTimelineEditorGroupedItemIds(document, command.itemIds),
      command.timeMs,
      options,
    );
    return result(document, tracks, selection, "Split at pointer");
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
    return documentResult(document, nextDocument, selection, "Add track");
  }

  if (command.type === "update-track") {
    const nextDocument = updateTimelineEditorTrack(
      document,
      command.trackId,
      command.patch,
      options,
    );
    return documentResult(document, nextDocument, selection, "Update track");
  }

  if (command.type === "move-track") {
    const nextDocument = moveTimelineEditorTrack(
      document,
      command.trackId,
      command.toIndex,
      options,
    );
    return documentResult(document, nextDocument, selection, "Move track");
  }

  if (command.type === "remove-track") {
    const nextDocument = removeTimelineEditorTrack(document, command.trackId, options);
    return documentResult(document, nextDocument, { itemIds: [] }, "Remove track");
  }

  if (command.type === "add-marker") {
    const nextDocument = addTimelineEditorMarker(document, command.marker, options);
    return documentResult(document, nextDocument, selection, "Add marker");
  }

  if (command.type === "update-marker") {
    const nextDocument = updateTimelineEditorMarker(
      document,
      command.markerId,
      command.patch,
      options,
    );
    return documentResult(document, nextDocument, selection, "Update marker");
  }

  if (command.type === "remove-marker") {
    const nextDocument = removeTimelineEditorMarker(document, command.markerId);
    return documentResult(document, nextDocument, selection, "Remove marker");
  }

  if (command.type === "add-track-group") {
    const nextDocument = addTimelineEditorTrackGroup(document, command.group, options);
    return documentResult(document, nextDocument, selection, "Add timeline group");
  }

  if (command.type === "update-track-group") {
    const nextDocument = updateTimelineEditorTrackGroup(
      document,
      command.groupId,
      command.patch,
      options,
    );
    return documentResult(document, nextDocument, selection, "Update timeline group");
  }

  if (command.type === "remove-track-group") {
    const nextDocument = removeTimelineEditorTrackGroup(document, command.groupId, options);
    return documentResult(document, nextDocument, selection, "Remove timeline group");
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

    const nextItem = {
      ...found.item,
      ...command.patch,
      id: found.item.id,
      trackId: found.track.id,
    };

    if (!canPlaceTimelineEditorItemOnTrack(nextItem, found.track)) {
      return { document, selection, label: "Update item", changed: false };
    }

    const tracks = normalizeTimelineEditorTracks(
      document.tracks.map((track) =>
        track.id === found.track.id
          ? {
              ...track,
              items: track.items.map((item) => (item.id === found.item.id ? nextItem : item)),
            }
          : track,
      ),
      options,
    );
    return result(document, tracks, selection, "Update item");
  }

  const tracks =
    command.type === "insert-gap"
      ? insertTimelineEditorGap(
          document.tracks,
          command.trackId,
          command.startMs,
          command.durationMs,
          options,
        )
      : closeTimelineEditorGap(
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
