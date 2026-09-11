import { describe, expect, it } from "vitest";

import { resizeTimelineEditorItems, type TimelineEditorTrack } from "../core";

function createTracks(): TimelineEditorTrack[] {
  return [
    {
      id: "timeline",
      label: "Timeline",
      items: [
        { id: "a", trackId: "timeline", label: "A", startMs: 25, durationMs: 100 },
        { id: "b", trackId: "timeline", label: "B", startMs: 175, durationMs: 100 },
      ],
    },
  ];
}

describe("atomic multi-item resize", () => {
  it("snaps one shared end-edge delta and preserves duration differences", () => {
    const tracks = createTracks();
    tracks[0]!.items[1]!.durationMs = 150;

    const resized = resizeTimelineEditorItems(tracks, ["a", "b"], "end", 60, {
      snapMs: 100,
      minItemDurationMs: 50,
    });

    expect(resized[0]!.items).toEqual([
      expect.objectContaining({ id: "a", startMs: 25, durationMs: 175 }),
      expect.objectContaining({ id: "b", startMs: 175, durationMs: 225 }),
    ]);
  });

  it("keeps an already snapped selected end edge anchored", () => {
    const tracks = createTracks();
    tracks[0]!.items[1]!.startMs = 100;

    const resized = resizeTimelineEditorItems(tracks, ["a", "b"], "end", 0, {
      snapMs: 100,
      minItemDurationMs: 50,
    });

    expect(resized).toBe(tracks);
  });

  it("clamps a shared start-edge resize to the shortest selected item", () => {
    const tracks = createTracks();
    tracks[0]!.items[0]!.startMs = 50;
    tracks[0]!.items[0]!.durationMs = 100;
    tracks[0]!.items[1]!.startMs = 200;
    tracks[0]!.items[1]!.durationMs = 300;

    const resized = resizeTimelineEditorItems(tracks, ["a", "b"], "start", 100, {
      minItemDurationMs: 50,
    });

    expect(resized[0]!.items).toEqual([
      expect.objectContaining({ id: "a", startMs: 100, durationMs: 50 }),
      expect.objectContaining({ id: "b", startMs: 250, durationMs: 250 }),
    ]);
  });

  it("clamps a shared end-edge resize at the timeline boundary", () => {
    const tracks = createTracks();
    tracks[0]!.items[0]!.startMs = 100;
    tracks[0]!.items[0]!.durationMs = 200;
    tracks[0]!.items[1]!.startMs = 700;
    tracks[0]!.items[1]!.durationMs = 200;

    const resized = resizeTimelineEditorItems(tracks, ["a", "b"], "end", 500, {
      durationMs: 1_000,
    });

    expect(resized[0]!.items).toEqual([
      expect.objectContaining({ id: "a", durationMs: 300 }),
      expect.objectContaining({ id: "b", durationMs: 300 }),
    ]);
  });

  it("rejects the whole resize when any requested item is locked", () => {
    const tracks = createTracks();
    tracks[0]!.items[1]!.locked = true;

    expect(resizeTimelineEditorItems(tracks, ["a", "b"], "end", 100)).toBe(tracks);
  });

  it("allows push policy to move followers while preserving the resized selection", () => {
    const tracks: TimelineEditorTrack[] = [
      {
        id: "timeline",
        label: "Timeline",
        items: [
          { id: "a", trackId: "timeline", label: "A", startMs: 0, durationMs: 100 },
          {
            id: "follower",
            trackId: "timeline",
            label: "Follower",
            startMs: 150,
            durationMs: 100,
          },
        ],
      },
    ];
    const resized = resizeTimelineEditorItems(tracks, ["a"], "end", 100, {
      editPolicy: { overlap: "push" },
    });

    expect(resized[0]!.items).toEqual([
      expect.objectContaining({ id: "a", startMs: 0, durationMs: 200 }),
      expect.objectContaining({ id: "follower", startMs: 200, durationMs: 100 }),
    ]);
  });

  it("rejects push policy when it would move a resized selected item", () => {
    const tracks: TimelineEditorTrack[] = [
      {
        id: "timeline",
        label: "Timeline",
        items: [
          {
            id: "blocker",
            trackId: "timeline",
            label: "Blocker",
            startMs: 0,
            durationMs: 200,
          },
          { id: "a", trackId: "timeline", label: "A", startMs: 200, durationMs: 100 },
        ],
      },
    ];

    expect(
      resizeTimelineEditorItems(tracks, ["a"], "start", -50, {
        editPolicy: { overlap: "push" },
        minItemDurationMs: 50,
      }),
    ).toBe(tracks);
  });
});
