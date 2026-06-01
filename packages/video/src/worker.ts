import { createTimelineComputeError, createTimelineWorkerHandler } from "@timeline-editor/compute";

createTimelineWorkerHandler({
  process(task) {
    if (task.domain !== "video") {
      throw createTimelineComputeError({
        code: "unsupported_source",
        message: `Video worker cannot process ${task.domain} tasks.`,
        recoverable: true,
      });
    }

    return {
      warnings: ["Video WASM analysis is not bundled yet; host fallback should be used."],
    };
  },
});
