import { describe, expect, it } from "vitest";

import {
  createTimelineEditorClipboard,
  duplicateTimelineEditorItems,
  pasteTimelineEditorClipboard,
  type TimelineEditorTrack,
} from "../core";

describe("atomic timeline clipboard operations", () => {
  it("preserves relative track topology when pasting into another document", () => {
    const sourceTracks: TimelineEditorTrack[] = [
      {
        id: "source-a",
        label: "Source A",
        items: [{ id: "a", trackId: "source-a", label: "A", startMs: 0, durationMs: 100 }],
      },
      { id: "source-gap", label: "Source gap", items: [] },
      {
        id: "source-b",
        label: "Source B",
        items: [{ id: "b", trackId: "source-b", label: "B", startMs: 50, durationMs: 100 }],
      },
    ];
    const targetTracks: TimelineEditorTrack[] = [
      { id: "target-a", label: "Target A", items: [] },
      { id: "target-gap", label: "Target gap", items: [] },
      { id: "target-b", label: "Target B", items: [] },
    ];
    const clipboard = createTimelineEditorClipboard(sourceTracks, ["a", "b"])!;
    const pasted = pasteTimelineEditorClipboard(
      targetTracks,
      clipboard,
      { timeMs: 1_000, trackId: "target-a" },
      { durationMs: 2_000 },
    );

    expect(clipboard.sourceTrackOffsets).toEqual([
      { trackId: "source-a", offset: 0 },
      { trackId: "source-b", offset: 2 },
    ]);
    expect(pasted.itemIds).toEqual(["a-copy", "b-copy"]);
    expect(pasted.tracks[0]!.items).toEqual([
      expect.objectContaining({ id: "a-copy", trackId: "target-a", startMs: 1_000 }),
    ]);
    expect(pasted.tracks[1]!.items).toEqual([]);
    expect(pasted.tracks[2]!.items).toEqual([
      expect.objectContaining({ id: "b-copy", trackId: "target-b", startMs: 1_050 }),
    ]);
  });

  it("anchors an explicit target track to the first clipboard item", () => {
    const tracks: TimelineEditorTrack[] = [
      {
        id: "upper",
        label: "Upper",
        items: [{ id: "later", trackId: "upper", label: "Later", startMs: 200, durationMs: 100 }],
      },
      {
        id: "lower",
        label: "Lower",
        items: [{ id: "earlier", trackId: "lower", label: "Earlier", startMs: 0, durationMs: 100 }],
      },
      { id: "target-upper", label: "Target upper", items: [] },
      { id: "target-lower", label: "Target lower", items: [] },
    ];
    const clipboard = createTimelineEditorClipboard(tracks, ["later", "earlier"])!;
    const pasted = pasteTimelineEditorClipboard(tracks, clipboard, {
      timeMs: 500,
      trackId: "target-lower",
    });

    expect(clipboard.items[0]?.id).toBe("earlier");
    expect(pasted.tracks[3]!.items).toEqual([
      expect.objectContaining({ id: "earlier-copy", startMs: 500 }),
    ]);
    expect(pasted.tracks[2]!.items).toEqual([
      expect.objectContaining({ id: "later-copy", startMs: 700 }),
    ]);
  });

  it("rejects the whole anchored paste when one target track is incompatible", () => {
    const tracks: TimelineEditorTrack[] = [
      {
        id: "source-video",
        label: "Source video",
        kind: "video",
        items: [
          {
            id: "video",
            trackId: "source-video",
            label: "Video",
            kind: "video",
            startMs: 0,
            durationMs: 100,
          },
        ],
      },
      {
        id: "source-audio",
        label: "Source audio",
        kind: "audio",
        items: [
          {
            id: "audio",
            trackId: "source-audio",
            label: "Audio",
            kind: "audio",
            startMs: 0,
            durationMs: 100,
          },
        ],
      },
      { id: "target-video-a", label: "Target video A", kind: "video", items: [] },
      { id: "target-video-b", label: "Target video B", kind: "video", items: [] },
    ];
    const clipboard = createTimelineEditorClipboard(tracks, ["video", "audio"])!;
    const pasted = pasteTimelineEditorClipboard(tracks, clipboard, {
      timeMs: 500,
      trackId: "target-video-a",
    });

    expect(pasted.tracks).toBe(tracks);
    expect(pasted.itemIds).toEqual([]);
  });

  it("clamps a pasted selection at the timeline edge without changing its spacing", () => {
    const tracks: TimelineEditorTrack[] = [
      {
        id: "timeline",
        label: "Timeline",
        items: [
          { id: "a", trackId: "timeline", label: "A", startMs: 0, durationMs: 200 },
          { id: "b", trackId: "timeline", label: "B", startMs: 300, durationMs: 200 },
        ],
      },
    ];
    const clipboard = createTimelineEditorClipboard(tracks, ["a", "b"])!;
    const pasted = pasteTimelineEditorClipboard(
      tracks,
      clipboard,
      { timeMs: 900 },
      {
        durationMs: 1_000,
      },
    );
    const copies = pasted.tracks[0]!.items.filter((item) => pasted.itemIds.includes(item.id));

    expect(copies.map((item) => item.startMs)).toEqual([500, 800]);
  });

  it("duplicates a multi-item selection as one rigid block", () => {
    const tracks: TimelineEditorTrack[] = [
      {
        id: "timeline",
        label: "Timeline",
        items: [
          { id: "a", trackId: "timeline", label: "A", startMs: 0, durationMs: 100 },
          { id: "b", trackId: "timeline", label: "B", startMs: 200, durationMs: 100 },
        ],
      },
    ];
    const duplicated = duplicateTimelineEditorItems(tracks, ["a", "b"]);

    expect(duplicated[0]!.items).toEqual([
      expect.objectContaining({ id: "a", startMs: 0 }),
      expect.objectContaining({ id: "b", startMs: 200 }),
      expect.objectContaining({ id: "a-copy", startMs: 300 }),
      expect.objectContaining({ id: "b-copy", startMs: 500 }),
    ]);
  });

  it("rejects overlap pushes that would distort a duplicated block", () => {
    const tracks: TimelineEditorTrack[] = [
      {
        id: "timeline",
        label: "Timeline",
        items: [
          { id: "a", trackId: "timeline", label: "A", startMs: 0, durationMs: 100 },
          { id: "b", trackId: "timeline", label: "B", startMs: 200, durationMs: 100 },
          {
            id: "blocker",
            trackId: "timeline",
            label: "Blocker",
            startMs: 350,
            durationMs: 300,
          },
        ],
      },
    ];

    expect(
      duplicateTimelineEditorItems(tracks, ["a", "b"], { editPolicy: { overlap: "push" } }),
    ).toBe(tracks);
  });

  it("rejects the whole duplicate when any requested item is locked", () => {
    const tracks: TimelineEditorTrack[] = [
      {
        id: "timeline",
        label: "Timeline",
        items: [
          { id: "a", trackId: "timeline", label: "A", startMs: 0, durationMs: 100 },
          {
            id: "b",
            trackId: "timeline",
            label: "B",
            startMs: 200,
            durationMs: 100,
            locked: true,
          },
        ],
      },
    ];

    expect(duplicateTimelineEditorItems(tracks, ["a", "b"])).toBe(tracks);
  });
});
