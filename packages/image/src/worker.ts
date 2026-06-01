import { createTimelineComputeError, createTimelineWorkerHandler } from "@timeline-editor/compute";

createTimelineWorkerHandler({
  process(task) {
    if (task.domain !== "image") {
      throw createTimelineComputeError({
        code: "unsupported_source",
        message: `Image worker cannot process ${task.domain} tasks.`,
        recoverable: true,
      });
    }

    return {
      warnings: ["Image WASM analysis is not bundled yet; host fallback should be used."],
    };
  },
});
