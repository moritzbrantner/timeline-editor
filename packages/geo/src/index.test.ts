import { describe, expect, test } from "vitest";

import { analyzeTimelineGeoJsonSync } from "./index";

describe("@timeline-editor/geo", () => {
  test("computes GeoJSON bounds", () => {
    const result = analyzeTimelineGeoJsonSync({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [1, 2],
          [3, 4],
        ],
      },
    });

    expect(result.bbox).toEqual([1, 2, 3, 4]);
    expect(result.center).toEqual([2, 3]);
  });
});
