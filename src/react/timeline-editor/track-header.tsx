"use client";

import { TimelineEditorContextActionMenu } from "./context-menu-items";
import { useTimelineEditor } from "./provider";
import type {
  TimelineEditorTrackContextMenuContext,
  TimelineEditorTrackHeaderProps,
} from "./types";

export function TimelineEditorTrackHeader<
  TTrackData extends Record<string, unknown> = Record<string, unknown>,
  TItemData = Record<string, unknown>,
>({ contextMenu = true, entry }: TimelineEditorTrackHeaderProps<TTrackData, TItemData>) {
  const editor = useTimelineEditor<TTrackData, TItemData>();
  const locked = Boolean(editor.readOnly || entry.locked);
  const selected = Boolean(
    editor.selection.itemIds.length === 0 && editor.selection.trackIds?.includes(entry.track.id),
  );
  const selectTrack = () => {
    editor.commitSelection({
      itemIds: [],
      anchorItemId: undefined,
      trackIds: [entry.track.id],
      markerIds: undefined,
      range: undefined,
    });
  };
  const trackContextMenuItems =
    contextMenu && editor.getTrackContextMenuItems
      ? editor.getTrackContextMenuItems({
          document: editor.document,
          durationMs: editor.durationMs,
          locked,
          readOnly: editor.readOnly,
          selection: editor.selection,
          selectedItems: editor.selectedItems,
          track: entry.track,
        } satisfies TimelineEditorTrackContextMenuContext<TTrackData, TItemData>)
      : [];
  const trackHeader = (
    <div
      data-slot="timeline-editor-track-header"
      data-selected={selected ? "true" : undefined}
      data-kind={entry.track.kind}
      data-locked={locked ? "true" : undefined}
      data-accepts-item-kinds={entry.track.acceptsItemKinds?.join(" ")}
      data-item-count={entry.track.items.length}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={entry.track.label}
      className="flex items-center border-r bg-muted/20 px-3 text-sm font-medium data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }

        event.stopPropagation();
        selectTrack();
      }}
      onClick={(event) => {
        if (event.button === 0) {
          selectTrack();
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        selectTrack();
      }}
    >
      {editor.renderTrackHeader ? (
        editor.renderTrackHeader({
          track: entry.track as never,
          locked: entry.locked,
          collapsed: false,
        })
      ) : (
        <TimelineEditorDefaultTrackHeaderContent locked={locked} track={entry.track} />
      )}
    </div>
  );

  if (trackContextMenuItems.length === 0) {
    return trackHeader;
  }

  return (
    <TimelineEditorContextActionMenu
      items={trackContextMenuItems}
      contentProps={{ "data-slot": "timeline-editor-track-menu" }}
    >
      {trackHeader}
    </TimelineEditorContextActionMenu>
  );
}

function TimelineEditorDefaultTrackHeaderContent<
  TTrackData extends Record<string, unknown>,
  TItemData,
>({
  locked,
  track,
}: {
  locked: boolean;
  track: TimelineEditorTrackHeaderProps<TTrackData, TItemData>["entry"]["track"];
}) {
  const itemCountLabel =
    track.items.length > 0
      ? `${track.items.length} ${track.items.length === 1 ? "item" : "items"}`
      : undefined;
  const acceptedKindsLabel = track.acceptsItemKinds?.length
    ? track.acceptsItemKinds.join(", ")
    : undefined;

  return (
    <span className="grid min-w-0 gap-0.5">
      <span data-slot="timeline-editor-track-header-label" className="truncate">
        {track.label}
      </span>
      {itemCountLabel || acceptedKindsLabel || locked ? (
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-normal text-muted-foreground">
          {itemCountLabel ? (
            <span data-slot="timeline-editor-track-header-meta" className="shrink-0">
              {itemCountLabel}
            </span>
          ) : null}
          {acceptedKindsLabel ? (
            <span data-slot="timeline-editor-track-header-kinds" className="truncate">
              {acceptedKindsLabel}
            </span>
          ) : null}
          {locked ? (
            <span
              data-slot="timeline-editor-track-header-lock"
              className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] leading-none"
            >
              Locked
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
