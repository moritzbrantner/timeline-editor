import { createTimelineWorkerHandler } from "@timeline-editor/compute";
import { analyzeTimelineGeoJsonSync } from "./index";

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
