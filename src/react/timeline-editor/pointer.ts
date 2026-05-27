import type { PointerEvent } from "react";

export function getTimelineEditorPointerClientX(event: Pick<PointerEvent, "clientX">) {
  return Number.isFinite(event.clientX) ? event.clientX : 0;
}

export function captureTimelineEditorPointer(element: Element, pointerId: number) {
  if (
    Number.isFinite(pointerId) &&
    "setPointerCapture" in element &&
    typeof element.setPointerCapture === "function"
  ) {
    element.setPointerCapture(pointerId);
  }
}
