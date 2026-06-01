import { createTimelineWorkerHandler } from "@timeline-editor/compute";
import {
  parseTimelineText,
  type TimelineTextParseOptions,
} from "@moritzbrantner/timeline-editor/text";

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
