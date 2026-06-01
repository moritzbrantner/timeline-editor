import { describe, expect, test } from "vitest";

import { analyzeTimelineNumericDataSync } from "./index";

describe("@timeline-editor/data", () => {
  test("downsamples numeric series", () => {
    const result = analyzeTimelineNumericDataSync(
      {
        mediaType: "numeric-data",
        series: [
          {
            points: Array.from({ length: 10 }, (_, index) => ({
              timeMs: index,
              value: index,
            })),
          },
        ],
      },
      { maxPoints: 5 },
    );

    expect(result.series[0]?.points).toHaveLength(5);
    expect(result.min).toBe(0);
  });
});
