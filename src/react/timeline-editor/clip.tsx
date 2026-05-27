"use client";

import { memo } from "react";
import type { ReactNode } from "react";

import { ContextActionMenu, cn, type MenuActionItem } from "@moritzbrantner/ui";

import type { TimelineEditorItem } from "../../types";
import { getTimelineEditorItemStyle } from "../timeline-rendering";
import type { TimelineEditorItemRenderContext } from "./types";

type TimelineEditorClipProps<TItemData> = {
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
  contextMenuItems,
  durationMs,
  item,
  locked,
  readOnly,
  selected,
  timelineWidthPx,
  renderItem,
  onContextMenu,
  onMovePointerDown,
  onResizePointerDown,
}: TimelineEditorClipProps<TItemData>) {
  const clip = (
    <div
      data-slot="timeline-editor-clip"
      data-selected={selected ? "true" : undefined}
      data-item-group-id={item.itemGroupId}
      role="button"
      tabIndex={-1}
      aria-pressed={selected}
      className={cn(
        "absolute top-2 bottom-2 flex min-w-8 cursor-grab items-center rounded-md border px-2 text-xs font-medium text-white shadow-sm outline-none data-[selected=true]:ring-2 data-[selected=true]:ring-ring",
        locked && "cursor-default opacity-60",
      )}
      style={{
        ...getTimelineEditorItemStyle(item.startMs, item.durationMs, timelineWidthPx, durationMs),
        backgroundColor: item.color ?? "var(--primary)",
      }}
      onContextMenu={(event) => {
        event.stopPropagation();
        onContextMenu();
      }}
      onPointerDown={onMovePointerDown}
    >
      <span
        aria-hidden="true"
        data-slot="timeline-editor-resize-start"
        className="absolute inset-y-1 left-0 w-2 cursor-ew-resize rounded-l-md bg-white/25"
        onPointerDown={(event) => onResizePointerDown("start", event)}
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
        onPointerDown={(event) => onResizePointerDown("end", event)}
      />
    </div>
  );

  if (contextMenuItems.length === 0) {
    return clip;
  }

  return (
    <ContextActionMenu
      items={contextMenuItems}
      contentProps={{ "data-slot": "timeline-editor-clip-menu" }}
    >
      {clip}
    </ContextActionMenu>
  );
}

export const TimelineEditorClip = memo(
  TimelineEditorClipComponent,
) as typeof TimelineEditorClipComponent;
