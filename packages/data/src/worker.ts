import { createTimelineWorkerHandler } from "@timeline-editor/compute";
import { analyzeTimelineNumericDataSync } from "./index";

const timelineDataWorkerScope = globalThis as typeof globalThis & {
  addEventListener?: unknown;
  postMessage?: unknown;
};

if (
  typeof timelineDataWorkerScope.addEventListener === "function" &&
  typeof timelineDataWorkerScope.postMessage === "function"
) {
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
}
