import type { TimelineEditorOperationOptions } from "../types";

export function getSnapMs(options: TimelineEditorOperationOptions) {
  const intervalTarget = options.snap?.targets?.find((target) => target.type === "interval");
  return intervalTarget?.type === "interval" ? intervalTarget.intervalMs : (options.snapMs ?? 0);
}
