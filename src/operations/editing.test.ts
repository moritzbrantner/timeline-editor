import { describe, expect, it } from "vitest";

import {
  slipTimelineEditorItem,
  trimTimelineEditorItem,
  type TimelineEditorSlipAdapter,
  type TimelineEditorTrack,
} from "../core";

type MediaData = {
  sourceOffsetMs: number;
  sourceDurationMs: number;
};

function createTracks(): Array<TimelineEditorTrack<Record<string, unknown>, MediaData>> {
  return [
    {
      id: "video",
      label: "Video",
      items: [
        {
          id: "a",
          trackId: "video",
          label: "A",
          startMs: 0,
          durationMs: 1_000,
          data: { sourceOffsetMs: 0, sourceDurationMs: 5_000 },
        },
        {
          id: "b",
          trackId: "video",
          label: "B",
          startMs: 1_000,
          durationMs: 1_000,
          data: { sourceOffsetMs: 500, sourceDurationMs: 5_000 },
        },
      ],
    },
  ];
}

const slipAdapter: TimelineEditorSlipAdapter<MediaData> = {
  getSourceOffsetMs: (item) => item.data?.sourceOffsetMs,
  setSourceOffsetMs: (item, sourceOffsetMs) => ({
    ...(item.data ?? { sourceDurationMs: 0 }),
    sourceOffsetMs,
  }),
  getSourceDurationMs: (item) => item.data?.sourceDurationMs,
};

describe("advanced timeline editing", () => {
  it("rolls an adjacent boundary atomically without changing the outer span", () => {
    const tracks = trimTimelineEditorItem(createTracks(), "a", "end", 1_200, "roll", {
      snapMs: 1,
    });
    const [left, right] = tracks[0]!.items;

    expect(left).toMatchObject({ startMs: 0, durationMs: 1_200 });
    expect(right).toMatchObject({ startMs: 1_200, durationMs: 800 });
    expect(right!.startMs + right!.durationMs).toBe(2_000);
  });

  it("rolls from the right-hand item start using the same shared boundary", () => {
    const tracks = trimTimelineEditorItem(createTracks(), "b", "start", 800, "roll", {
      snapMs: 1,
    });
    const [left, right] = tracks[0]!.items;

    expect(left).toMatchObject({ startMs: 0, durationMs: 800 });
    expect(right).toMatchObject({ startMs: 800, durationMs: 1_200 });
  });

  it("requires truly adjacent unlocked items for a roll", () => {
    const tracks = createTracks();
    tracks[0]!.items[1]!.startMs = 1_100;

    expect(trimTimelineEditorItem(tracks, "a", "end", 1_200, "roll")).toBe(tracks);
  });

  it("slips source content without changing timeline placement", () => {
    const tracks = slipTimelineEditorItem(
      createTracks(),
      { itemId: "b", deltaMs: 750 },
      slipAdapter,
    );
    const item = tracks[0]!.items[1]!;

    expect(item).toMatchObject({ startMs: 1_000, durationMs: 1_000 });
    expect(item.data).toEqual({ sourceOffsetMs: 1_250, sourceDurationMs: 5_000 });
  });

  it("clamps slip against the available source window", () => {
    const tracks = slipTimelineEditorItem(
      createTracks(),
      { itemId: "b", deltaMs: 10_000 },
      slipAdapter,
    );

    expect(tracks[0]!.items[1]!.data?.sourceOffsetMs).toBe(4_000);
  });
});
