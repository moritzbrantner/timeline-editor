import { describe, expect, it } from "vitest";

import { moveTimelineEditorItems, type TimelineEditorTrack } from "../core";

function createSingleTrackSelection(): Array<TimelineEditorTrack> {
  return [
    {
      id: "video",
      label: "Video",
      items: [
        {
          id: "a",
          trackId: "video",
          label: "A",
          startMs: 25,
          durationMs: 100,
        },
        {
          id: "b",
          trackId: "video",
          label: "B",
          startMs: 175,
          durationMs: 100,
        },
      ],
    },
  ];
}

describe("atomic multi-item moves", () => {
  it("snaps the selection once and preserves relative item spacing", () => {
    const tracks = moveTimelineEditorItems(createSingleTrackSelection(), ["a", "b"], 60, {
      snapMs: 100,
    });

    expect(tracks[0]!.items.map((item) => item.startMs)).toEqual([100, 250]);
  });

  it("clamps the selection as one unit at the timeline boundary", () => {
    const tracks = createSingleTrackSelection();
    tracks[0]!.items[0]!.startMs = 50;
    tracks[0]!.items[1]!.startMs = 200;

    const moved = moveTimelineEditorItems(tracks, ["a", "b"], -100);

    expect(moved[0]!.items.map((item) => item.startMs)).toEqual([0, 150]);
  });

  it("clamps track movement once so the selected track spacing is preserved", () => {
    const tracks: Array<TimelineEditorTrack> = [
      {
        id: "one",
        label: "One",
        items: [
          { id: "a", trackId: "one", label: "A", startMs: 0, durationMs: 100 },
        ],
      },
      {
        id: "two",
        label: "Two",
        items: [
          { id: "b", trackId: "two", label: "B", startMs: 200, durationMs: 100 },
        ],
      },
      { id: "three", label: "Three", items: [] },
    ];

    const moved = moveTimelineEditorItems(tracks, ["a", "b"], 0, { trackDelta: 5 });

    expect(moved[0]!.items).toHaveLength(0);
    expect(moved[1]!.items.map((item) => item.id)).toEqual(["a"]);
    expect(moved[2]!.items.map((item) => item.id)).toEqual(["b"]);
  });

  it("rejects the whole move when any selected item cannot enter its target track", () => {
    const tracks: Array<TimelineEditorTrack> = [
      {
        id: "one",
        label: "One",
        kind: "video",
        items: [
          {
            id: "a",
            trackId: "one",
            label: "A",
            kind: "video",
            startMs: 0,
            durationMs: 100,
          },
        ],
      },
      {
        id: "two",
        label: "Two",
        kind: "video",
        items: [
          {
            id: "b",
            trackId: "two",
            label: "B",
            kind: "video",
            startMs: 200,
            durationMs: 100,
          },
        ],
      },
      { id: "three", label: "Three", kind: "audio", items: [] },
    ];

    expect(moveTimelineEditorItems(tracks, ["a", "b"], 0, { trackDelta: 1 })).toBe(tracks);
  });
});
