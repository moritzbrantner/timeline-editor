import { createTimelineWorkerHandler } from "@timeline-editor/compute";
import {
  parseTimelineText,
  type TimelineTextParseOptions,
} from "@moritzbrantner/timeline-editor/text";

const timelineCaptionsWorkerScope = globalThis as typeof globalThis & {
  addEventListener?: unknown;
  postMessage?: unknown;
};

if (
  typeof timelineCaptionsWorkerScope.addEventListener === "function" &&
  typeof timelineCaptionsWorkerScope.postMessage === "function"
) {
  createTimelineWorkerHandler({
    process(task) {
      if (task.domain !== "captions" || task.operation !== "parse") {
        throw {
          code: "unsupported_source",
          message: `Captions worker cannot process ${task.domain} tasks.`,
          recoverable: true,
        };
      }

      return parseTimelineText(
        task.input ?? "",
        task.options as TimelineTextParseOptions | undefined,
      );
    },
  });
}
