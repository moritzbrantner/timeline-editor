import { createTimelineWorkerHandler } from "@timeline-editor/compute";
import { analyzeTimelineNumericDataSync } from "./index";

createTimelineWorkerHandler({
  process(task) {
    if (task.domain !== "data") {
      throw {
        code: "unsupported_source",
        message: `Data worker cannot process ${task.domain} tasks.`,
        recoverable: true,
      };
    }

    return analyzeTimelineNumericDataSync(
      {
        mediaType: "numeric-data",
        series: task.series ?? [],
      },
      task.options,
    );
  },
});
