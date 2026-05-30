"use client";

import { useTimelineEditor } from "./provider";
import type { TimelineEditorContentProps } from "./types";

export function TimelineEditorContent({ children, style, ...props }: TimelineEditorContentProps) {
  const { editorWidthPx } = useTimelineEditor();

  return (
    <div className="relative" style={{ width: editorWidthPx, ...style }} {...props}>
      {children}
    </div>
  );
}
