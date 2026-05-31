"use client";

import { memo } from "react";
import type { ReactNode } from "react";

import { cn, type MenuActionItem } from "@moritzbrantner/ui";

import type { TimelineEditorItem } from "../../types";
import { formatTimelineEditorTimeMs } from "../../time";
import { getTimelineEditorItemStyle } from "../timeline-rendering";
import { TimelineEditorContextActionMenu } from "./context-menu-items";
import { useOptionalTimelineEditor } from "./provider";
import type { TimelineEditorClipPublicProps, TimelineEditorItemRenderContext } from "./types";

export type TimelineEditorClipProps<TItemData> = TimelineEditorClipPublicProps<TItemData> & {
  contextMenuItems: MenuActionItem[];
  durationMs: number;
  item: TimelineEditorItem<TItemData>;
  locked: boolean;
  readOnly: boolean;
  selected: boolean;
  timelineWidthPx: number;
  renderItem?: (context: TimelineEditorItemRenderContext<TItemData>) => ReactNode;
  onContextMenu: () => void;
  onMovePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onResizePointerDown: (edge: "start" | "end", event: React.PointerEvent<HTMLSpanElement>) => void;
};

function TimelineEditorClipComponent<TItemData>({
  contextMenuItems: contextMenuItemsProp,
  durationMs: durationMsProp,
  item,
  locked: lockedProp,
  readOnly: readOnlyProp,
  selected: selectedProp,
  timelineWidthPx: timelineWidthPxProp,
  track,
  renderItem: renderItemProp,
  onContextMenu,
  onMovePointerDown,
  onResizePointerDown,
}: TimelineEditorClipPublicProps<TItemData>) {
  const editor = useOptionalTimelineEditor<Record<string, unknown>, TItemData>();
  const selected = selectedProp ?? Boolean(editor?.selectedIds.has(item.id));
  const readOnly = readOnlyProp ?? Boolean(editor?.readOnly);
  const locked = lockedProp ?? Boolean(readOnly || item.locked || track?.locked);
  const durationMs = durationMsProp ?? editor?.durationMs ?? item.startMs + item.durationMs;
  const timelineWidthPx =
    timelineWidthPxProp ?? editor?.timelineWidthPx ?? Math.max(640, item.durationMs);
  const renderItem = renderItemProp ?? editor?.renderItem;
  const contextMenuItems =
    contextMenuItemsProp ??
    (editor?.getItemContextMenuItems && track
      ? editor.getItemContextMenuItems({
          document: editor.document,
          durationMs,
          item,
          readOnly: locked,
          selected,
          selectedItems: editor.selectedItems,
          selection: editor.selection,
          track,
        })
      : []);
  const handleContextMenu =
    onContextMenu ??
    (() => {
      if (editor && !editor.selectedIds.has(item.id)) {
        editor.commitSelection({ itemIds: [item.id], anchorItemId: item.id });
      }
    });
  const handleMovePointerDown =
    onMovePointerDown ??
    ((event) => {
      if (editor && track) {
        editor.beginClipMove(item, track, locked, event);
      }
    });
  const handleResizePointerDown =
    onResizePointerDown ??
    ((edge, event) => {
      if (editor) {
        editor.beginClipResize(edge, item, locked, event);
      }
    });
  const clip = (
    <div
      data-slot="timeline-editor-clip"
      data-selected={selected ? "true" : undefined}
      data-item-group-id={item.itemGroupId}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={item.label}
      title={`${item.label} · ${formatTimelineEditorTimeMs(item.startMs)} · ${formatTimelineEditorTimeMs(item.durationMs)}`}
      className={cn(
        "absolute flex min-w-8 cursor-grab items-center rounded-md border px-2 text-xs font-medium text-white shadow-sm outline-none data-[selected=true]:ring-2 data-[selected=true]:ring-ring",
        locked && "cursor-default",
      )}
      style={{
        ...getTimelineEditorItemStyle(item.startMs, item.durationMs, timelineWidthPx, durationMs),
        top: 8,
        bottom: 8,
        backgroundColor: item.color ?? "var(--primary)",
      }}
      onContextMenu={(event) => {
        event.stopPropagation();
        handleContextMenu();
      }}
      onPointerDown={handleMovePointerDown}
    >
      <span
        aria-hidden="true"
        data-slot="timeline-editor-resize-start"
        className="absolute inset-y-1 left-0 w-2 cursor-ew-resize rounded-l-md bg-white/25"
        onPointerDown={(event) => handleResizePointerDown("start", event)}
      />
      {renderItem ? (
        renderItem({ item, selected, readOnly })
      ) : (
        <span className="truncate">{item.label}</span>
      )}
      <span
        aria-hidden="true"
        data-slot="timeline-editor-resize-end"
        className="absolute inset-y-1 right-0 w-2 cursor-ew-resize rounded-r-md bg-white/25"
        onPointerDown={(event) => handleResizePointerDown("end", event)}
      />
    </div>
  );

  if (contextMenuItems.length === 0) {
    return clip;
  }

  return (
    <TimelineEditorContextActionMenu
      items={contextMenuItems}
      contentProps={{ "data-slot": "timeline-editor-clip-menu" }}
    >
      {clip}
    </TimelineEditorContextActionMenu>
  );
}

export const TimelineEditorClip = memo(
  TimelineEditorClipComponent,
) as typeof TimelineEditorClipComponent;
