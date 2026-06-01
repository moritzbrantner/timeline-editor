import { createTimelineComputeError, createTimelineWorkerHandler } from "@timeline-editor/compute";

createTimelineWorkerHandler({
  process(task) {
    if (task.domain !== "audio") {
      throw createTimelineComputeError({
        code: "unsupported_source",
        message: `Audio worker cannot process ${task.domain} tasks.`,
        recoverable: true,
      });
    }

    return {
      warnings: ["Audio WASM analysis is not bundled yet; host fallback should be used."],
    };
  },
});
