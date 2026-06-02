import { createTimelineComputeError, createTimelineWorkerHandler } from "@timeline-editor/compute";
import type {
  TimelineComputeTaskProcessor,
  TimelineVideoComputeTask,
} from "@timeline-editor/compute";

export function analyzeTimelineVideoWorkerTask(_task: TimelineVideoComputeTask) {
  return {
    warnings: [
      "Video worker analysis is unavailable; browser media metadata fallback should be used.",
    ],
  };
}

const processVideoWorkerTask: TimelineComputeTaskProcessor = (task) => {
  if (task.domain !== "video") {
    throw createTimelineComputeError({
      code: "unsupported_source",
      message: `Video worker cannot process ${task.domain} tasks.`,
      recoverable: true,
    });
  }

  return analyzeTimelineVideoWorkerTask(task);
};

const timelineVideoWorkerScope = globalThis as typeof globalThis & {
  addEventListener?: unknown;
  postMessage?: unknown;
};

if (
  typeof timelineVideoWorkerScope.addEventListener === "function" &&
  typeof timelineVideoWorkerScope.postMessage === "function"
) {
  createTimelineWorkerHandler({ process: processVideoWorkerTask });
}
