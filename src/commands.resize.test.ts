import { describe, expect, test } from "vitest";

import { applyTimelineEditorCommand } from "./commands";
import {
  applyTimelineEditorCommandWithHistory,
  createTimelineEditorHistory,
  undoTimelineEditorHistory,
} from "./history";
import type { TimelineEditorDocument, TimelineEditorSelection } from "./types";

describe("timeline editor resize commands", () => {
  test("preserves custom minimum duration through command normalization", () => {
    const document: TimelineEditorDocument = {
      durationMs: 1_000,
      tracks: [
        {
          id: "track",
          label: "Track",
          items: [
            {
              id: "short",
              trackId: "track",
              label: "Short",
              startMs: 100,
              durationMs: 150,
            },
            {
              id: "long",
              trackId: "track",
              label: "Long",
              startMs: 400,
              durationMs: 300,
            },
          ],
        },
      ],
    };
    const selection: TimelineEditorSelection = {
      itemIds: ["short", "long"],
      anchorItemId: "short",
    };
    const options = { durationMs: 1_000, minItemDurationMs: 10 };

    const resizedItems = applyTimelineEditorCommand(
      document,
      selection,
      {
        type: "resize-items",
        itemIds: ["short", "long"],
        edge: "start",
        deltaMs: 100,
      },
      options,
    );

    expect(
      resizedItems.document.tracks[0]?.items.map(({ startMs, durationMs }) => ({
        startMs,
        durationMs,
      })),
    ).toEqual([
      { startMs: 200, durationMs: 50 },
      { startMs: 500, durationMs: 200 },
    ]);
    expect(resizedItems.selection).toEqual(selection);

    const resizedItem = applyTimelineEditorCommand(
      document,
      { itemIds: ["short"], anchorItemId: "short" },
      { type: "resize-item", itemId: "short", edge: "start", timeMs: 200 },
      options,
    );

    expect(resizedItem.document.tracks[0]?.items[0]).toEqual(
      expect.objectContaining({ startMs: 200, durationMs: 50 }),
    );
  });

  test("expands item groups and records the resize as one selection-preserving transaction", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      itemGroups: [{ id: "pair", label: "Pair", itemIds: ["brief", "draft"] }],
      tracks: [
        {
          id: "planning",
          label: "Planning",
          items: [
            {
              id: "brief",
              trackId: "planning",
              itemGroupId: "pair",
              label: "Brief",
              startMs: 1_000,
              durationMs: 1_000,
            },
            {
              id: "draft",
              trackId: "planning",
              itemGroupId: "pair",
              label: "Draft",
              startMs: 3_000,
              durationMs: 1_000,
            },
          ],
        },
      ],
    };
    const selection: TimelineEditorSelection = { itemIds: ["brief"], anchorItemId: "brief" };

    const resized = applyTimelineEditorCommandWithHistory(
      document,
      selection,
      createTimelineEditorHistory(),
      {
        type: "resize-items",
        itemIds: ["brief"],
        edge: "end",
        deltaMs: 250,
      },
      { durationMs: 8_000 },
    );

    expect(resized.document.tracks[0]?.items.map((item) => item.durationMs)).toEqual([
      1_250, 1_250,
    ]);
    expect(resized.selection).toEqual(selection);
    expect(resized.history.undoStack).toHaveLength(1);
    expect(resized.history.undoStack[0]?.selectionBefore).toEqual(selection);
    expect(resized.history.undoStack[0]?.selectionAfter).toEqual(selection);

    const undone = undoTimelineEditorHistory(resized.history);

    expect(undone.document?.tracks[0]?.items.map((item) => item.durationMs)).toEqual([
      1_000, 1_000,
    ]);
  });
});
