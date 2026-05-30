"use client";

import { cn } from "@moritzbrantner/ui";

import { useTimelineEditor } from "./provider";
import type { TimelineEditorRootProps } from "./types";

export function TimelineEditorRoot({
  children,
  className,
  onMouseDownCapture,
  onMouseLeave,
  onMouseMove,
  onMouseUp,
  onPointerCancel,
  onPointerDown,
  onPointerDownCapture,
  onPointerMove,
  onPointerUp,
  onKeyDown,
  onScroll,
  style,
  ...props
}: TimelineEditorRootProps) {
  const editor = useTimelineEditor();

  return (
    <div
      data-slot="timeline-editor"
      data-read-only={editor.readOnly ? "true" : undefined}
      ref={editor.scrollerRef}
      className={cn(
        "min-w-0 max-w-full overflow-auto rounded-md border bg-card text-card-foreground",
        className,
      )}
      style={{
        overscrollBehavior: "contain",
        overflowAnchor: "none",
        ...style,
      }}
      tabIndex={0}
      onPointerMove={(event) => {
        editor.handlePointerMove(event);
        onPointerMove?.(event);
      }}
      onPointerDownCapture={(event) => {
        editor.handlePointerDownCapture(event);
        onPointerDownCapture?.(event);
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        editor.handlePointerDown(event);
      }}
      onPointerUp={(event) => {
        editor.commitDrag(event);
        onPointerUp?.(event);
      }}
      onPointerCancel={(event) => {
        editor.cancelDrag();
        onPointerCancel?.(event);
      }}
      onMouseDownCapture={(event) => {
        editor.handleMouseDownCapture(event);
        onMouseDownCapture?.(event);
      }}
      onMouseMove={(event) => {
        editor.handleMouseMove(event);
        onMouseMove?.(event);
      }}
      onMouseUp={(event) => {
        editor.clearMouseInteraction();
        onMouseUp?.(event);
      }}
      onMouseLeave={(event) => {
        editor.clearMouseInteraction();
        onMouseLeave?.(event);
      }}
      onKeyDown={(event) => {
        editor.handleKeyDown(event);
        onKeyDown?.(event);
      }}
      onScroll={(event) => {
        editor.handleScroll(event);
        onScroll?.(event);
      }}
      {...props}
    >
      {children}
    </div>
  );
}
