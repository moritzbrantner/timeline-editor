import { createTimelineWorkerHandler } from "@timeline-editor/compute";
import { analyzeTimelineGeoJsonSync } from "./index";

const timelineGeoWorkerScope = globalThis as typeof globalThis & {
  addEventListener?: unknown;
  postMessage?: unknown;
};

if (
  typeof timelineGeoWorkerScope.addEventListener === "function" &&
  typeof timelineGeoWorkerScope.postMessage === "function"
) {
  createTimelineWorkerHandler({
    process(task) {
      if (task.domain !== "geo") {
        throw {
          code: "unsupported_source",
          message: `Geo worker cannot process ${task.domain} tasks.`,
          recoverable: true,
        };
      }

      return analyzeTimelineGeoJsonSync(task.geojson);
    },
  });
}
