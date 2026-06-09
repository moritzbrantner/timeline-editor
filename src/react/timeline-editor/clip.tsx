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

type TimelineEditorClipDensity = "minimal" | "compact" | "full";

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
  const itemWidthPx = Math.max(32, (item.durationMs / Math.max(1, durationMs)) * timelineWidthPx);
  const pixelsPerSecond =
    editor?.viewport.pixelsPerSecond ?? (timelineWidthPx / Math.max(1, durationMs)) * 1_000;
  const density = getTimelineEditorClipDensity(itemWidthPx);
  const transformPointCount = item.transform?.points.length ?? 0;
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
        event.preventDefault();
        editor.beginClipResize(edge, item, locked, event);
      }
    });
  const title = getTimelineEditorClipTitle(item, locked, transformPointCount);
  const handleClassName = cn(
    "absolute inset-y-0 z-10 w-4 touch-none bg-white/25 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[selected=true]:opacity-100",
    locked ? "cursor-default bg-transparent" : "cursor-ew-resize",
  );
  const clip = (
    <div
      data-slot="timeline-editor-clip"
      data-selected={selected ? "true" : undefined}
      data-item-group-id={item.itemGroupId}
      data-kind={item.kind}
      data-locked={locked ? "true" : undefined}
      data-density={density}
      data-has-transform={transformPointCount > 0 ? "true" : undefined}
      data-transform-point-count={transformPointCount || undefined}
      data-grouped={item.itemGroupId ? "true" : undefined}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={item.label}
      title={title}
      className={cn(
        "group absolute flex min-w-8 cursor-grab items-center rounded-md border px-2 text-xs font-medium text-white shadow-sm outline-none data-[selected=true]:ring-2 data-[selected=true]:ring-ring",
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
        className={cn(handleClassName, "left-0 rounded-l-md")}
        onPointerDown={(event) => handleResizePointerDown("start", event)}
      />
      {renderItem ? (
        renderItem({
          item,
          selected,
          readOnly,
          durationMs,
          timelineWidthPx,
          itemWidthPx,
          pixelsPerSecond,
        })
      ) : (
        <TimelineEditorDefaultClipContent
          density={density}
          item={item}
          locked={locked}
          transformPointCount={transformPointCount}
        />
      )}
      <span
        aria-hidden="true"
        data-slot="timeline-editor-resize-end"
        className={cn(handleClassName, "right-0 rounded-r-md")}
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

function TimelineEditorDefaultClipContent<TItemData>({
  density,
  item,
  locked,
  transformPointCount,
}: {
  density: TimelineEditorClipDensity;
  item: TimelineEditorItem<TItemData>;
  locked: boolean;
  transformPointCount: number;
}) {
  if (density === "minimal") {
    return (
      <span
        aria-hidden="true"
        data-slot="timeline-editor-clip-identity"
        className="mx-auto inline-flex size-4 shrink-0 items-center justify-center rounded-sm bg-black/20 text-[10px] font-semibold uppercase leading-none text-white/90"
      >
        {getTimelineEditorClipIdentity(item)}
      </span>
    );
  }

  if (density === "compact") {
    return (
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span data-slot="timeline-editor-clip-label" className="min-w-0 flex-1 truncate">
          {item.label}
        </span>
        {locked ? (
          <TimelineEditorClipBadge slot="timeline-editor-clip-lock">Locked</TimelineEditorClipBadge>
        ) : null}
        {transformPointCount > 0 ? (
          <TimelineEditorClipBadge slot="timeline-editor-clip-transform">
            {formatTimelineEditorKeyframeCount(transformPointCount)}
          </TimelineEditorClipBadge>
        ) : null}
      </span>
    );
  }

  const metadata = getTimelineEditorClipMetadata(item, locked, transformPointCount);

  return (
    <span className="grid min-w-0 flex-1 gap-0.5">
      <span data-slot="timeline-editor-clip-label" className="truncate leading-tight">
        {item.label}
      </span>
      {metadata.length > 0 ? (
        <span
          data-slot="timeline-editor-clip-meta"
          className="flex min-w-0 items-center gap-1.5 truncate text-[10px] leading-tight text-white"
        >
          {metadata.map((entry) => (
            <span key={entry} className="truncate">
              {entry}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}

function TimelineEditorClipBadge({ children, slot }: { children: ReactNode; slot: string }) {
  return (
    <span
      data-slot={slot}
      className="shrink-0 rounded bg-black/20 px-1.5 py-0.5 text-[10px] leading-none text-white/85"
    >
      {children}
    </span>
  );
}

function getTimelineEditorClipDensity(itemWidthPx: number): TimelineEditorClipDensity {
  if (itemWidthPx < 64) {
    return "minimal";
  }

  if (itemWidthPx < 140) {
    return "compact";
  }

  return "full";
}

function getTimelineEditorClipIdentity<TItemData>(item: TimelineEditorItem<TItemData>) {
  return (item.kind?.trim().charAt(0) || item.label.trim().charAt(0) || "?").toUpperCase();
}

function getTimelineEditorClipMetadata<TItemData>(
  item: TimelineEditorItem<TItemData>,
  locked: boolean,
  transformPointCount: number,
) {
  return [
    item.kind,
    formatTimelineEditorTimeMs(item.durationMs),
    transformPointCount > 0 ? formatTimelineEditorKeyframeCount(transformPointCount) : undefined,
    item.itemGroupId ? "Grouped" : undefined,
    locked ? "Locked" : undefined,
  ].filter((entry): entry is string => Boolean(entry));
}

function getTimelineEditorClipTitle<TItemData>(
  item: TimelineEditorItem<TItemData>,
  locked: boolean,
  transformPointCount: number,
) {
  return [
    item.label,
    formatTimelineEditorTimeMs(item.startMs),
    formatTimelineEditorTimeMs(item.durationMs),
    item.kind,
    locked ? "Locked" : undefined,
    item.itemGroupId ? "Grouped" : undefined,
    transformPointCount > 0 ? formatTimelineEditorKeyframeCount(transformPointCount) : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatTimelineEditorKeyframeCount(count: number) {
  return `${count} ${count === 1 ? "keyframe" : "keyframes"}`;
}
