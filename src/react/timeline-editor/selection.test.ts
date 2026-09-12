import { describe, expect, test } from "vitest";

import { getRangeSelectionIds } from "./selection";
import type { TimelineEditorTrack } from "../../types";

function createTrack(items: Array<{ id: string; startMs: number }>): TimelineEditorTrack {
  return {
    id: "track",
    label: "Track",
    items: items.map((item) => ({
      ...item,
      trackId: "track",
      label: item.id,
      durationMs: 100,
    })),
  };
}

describe("timeline editor range selection", () => {
  test("uses normalized track order for range selection", () => {
    const track = createTrack([
      { id: "a", startMs: 0 },
      { id: "b", startMs: 100 },
      { id: "c", startMs: 200 },
    ]);

    expect(getRangeSelectionIds(track, "a", "c")).toEqual(["a", "b", "c"]);
  });

  test("preserves sorted fallback semantics for unnormalized tracks", () => {
    const track = createTrack([
      { id: "c", startMs: 100 },
      { id: "b", startMs: 0 },
      { id: "a", startMs: 0 },
    ]);

    expect(getRangeSelectionIds(track, "a", "c")).toEqual(["a", "b", "c"]);
  });

  test("uses the fallback ordering when a start time is NaN", () => {
    const track = createTrack([
      { id: "z", startMs: Number.NaN },
      { id: "a", startMs: 0 },
      { id: "b", startMs: 100 },
    ]);

    expect(getRangeSelectionIds(track, "z", "a")).toEqual(["a", "b", "z"]);
  });
});
