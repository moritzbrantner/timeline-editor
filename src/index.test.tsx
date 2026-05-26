import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, test, vi } from "vitest";

import {
  TimelineWorkbench,
  applyTimelineEditorCommand,
  applyTimelineEditorCommandWithHistory,
  clampTimelineEditorTime,
  closeTimelineEditorGap,
  createTimelineEditorHistory,
  detectTimelineEditorOverlaps,
  duplicateTimelineEditorItem,
  findTimelineEditorItem,
  formatTimelineEditorTimeMs,
  getTimelineEditorTicks,
  migrateTimelineEditorDocument,
  moveTimelineEditorItem,
  normalizeTimelineEditorTracks,
  parseTimelineEditorDocument,
  removeTimelineEditorItem,
  resizeTimelineEditorItem,
  rippleDeleteTimelineEditorItems,
  serializeTimelineEditorDocument,
  splitTimelineEditorItem,
  undoTimelineEditorHistory,
  validateTimelineEditorDocument,
  type TimelineEditorDocument,
  type TimelineEditorTrack,
} from "@moritzbrantner/timeline-editor";

const tracks: TimelineEditorTrack[] = normalizeTimelineEditorTracks([
  {
    id: "planning",
    label: "Planning",
    acceptsItemKinds: ["task", "review"],
    items: [
      {
        id: "brief",
        trackId: "planning",
        label: "Brief",
        kind: "task",
        startMs: 1_000,
        durationMs: 2_000,
        color: "#2563eb",
      },
    ],
  },
  {
    id: "review",
    label: "Review",
    acceptsItemKinds: ["review"],
    items: [],
  },
]);

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      disconnect() {}
      observe() {}
      unobserve() {}
    },
  );
});

describe("@moritzbrantner/timeline-editor core", () => {
  test("normalizes, formats, and moves items across compatible tracks", () => {
    expect(formatTimelineEditorTimeMs(65_430)).toBe("1:05.4");
    expect(clampTimelineEditorTime(Number.POSITIVE_INFINITY, 0, 5_000)).toBe(5_000);
    expect(clampTimelineEditorTime(Number.NaN, 0, 5_000)).toBe(0);
    expect(
      normalizeTimelineEditorTracks([
        {
          id: "invalid",
          label: "Invalid",
          items: [
            {
              id: "bad-time",
              trackId: "wrong-track",
              label: "Bad time",
              startMs: Number.NaN,
              durationMs: -10,
            },
          ],
        },
      ])[0]?.items[0],
    ).toEqual(expect.objectContaining({ durationMs: 100, startMs: 0, trackId: "invalid" }));

    const moved = moveTimelineEditorItem(
      tracks,
      { itemId: "brief", startMs: -200, trackId: "review" },
      { durationMs: 10_000 },
    );

    expect(moved[0]?.items[0]?.trackId).toBe("planning");
    expect(
      moveTimelineEditorItem([{ ...tracks[0]!, locked: true }], {
        itemId: "brief",
        startMs: 2_000,
      }),
    ).toEqual([{ ...tracks[0]!, locked: true }]);

    const reviewItemTracks = [
      {
        ...tracks[0]!,
        items: [{ ...tracks[0]!.items[0]!, kind: "review" }],
      },
      tracks[1]!,
    ];
    const movedReview = moveTimelineEditorItem(reviewItemTracks, {
      itemId: "brief",
      startMs: 1_500,
      trackId: "review",
    });

    expect(movedReview[1]?.items[0]).toEqual(
      expect.objectContaining({ id: "brief", startMs: 1_500, trackId: "review" }),
    );
  });

  test("resizes, splits, duplicates, removes, and detects overlaps", () => {
    const resized = resizeTimelineEditorItem(tracks, {
      itemId: "brief",
      edge: "end",
      durationMs: 3_000,
    });
    const split = splitTimelineEditorItem(resized, { itemId: "brief", timeMs: 2_000 });
    const duplicated = duplicateTimelineEditorItem(split, {
      itemId: "brief",
      startMs: 1_500,
      createId: () => "brief-part-2",
    });

    expect(findTimelineEditorItem(duplicated, "brief-part-2-2")).toBeTruthy();
    expect(detectTimelineEditorOverlaps(duplicated)).toHaveLength(2);

    const minimumSplit = splitTimelineEditorItem(tracks, { itemId: "brief", timeMs: 1_100 });
    expect(findTimelineEditorItem(minimumSplit, "brief-part-2")).toBeTruthy();

    const removed = removeTimelineEditorItem(duplicated, "brief-part-2-2");
    expect(findTimelineEditorItem(removed, "brief-part-2-2")).toBeUndefined();
  });

  test("validates, serializes, migrates, and creates timeline ticks", () => {
    const document: TimelineEditorDocument = { tracks, durationMs: 8_000 };
    const serialized = serializeTimelineEditorDocument(document);

    expect(serialized.schemaVersion).toBe(1);
    expect(parseTimelineEditorDocument(serialized).tracks[0]?.items[0]?.id).toBe("brief");
    expect(migrateTimelineEditorDocument(document).schemaVersion).toBe(1);
    expect(validateTimelineEditorDocument(document)).toHaveLength(0);
    expect(getTimelineEditorTicks(2_000, 1_000)).toEqual([
      { timeMs: 0, label: "0:00.0", major: true },
      { timeMs: 1_000, label: "0:01.0", major: false },
      { timeMs: 2_000, label: "0:02.0", major: false },
    ]);
  });

  test("applies commands, history, ripple delete, and gap closing", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      groups: [{ id: "phase", label: "Phase", trackIds: ["planning"] }],
      tracks: [
        {
          id: "planning",
          label: "Planning",
          items: [
            { id: "brief", trackId: "planning", label: "Brief", startMs: 1_000, durationMs: 1_000 },
            { id: "draft", trackId: "planning", label: "Draft", startMs: 3_000, durationMs: 1_000 },
          ],
        },
      ],
    };
    const selection = { itemIds: ["brief"], anchorItemId: "brief" };
    const moved = applyTimelineEditorCommand(
      document,
      selection,
      { type: "move-items", itemIds: ["brief"], deltaMs: 500 },
      { durationMs: 8_000 },
    );

    expect(moved.document.tracks[0]?.items[0]?.startMs).toBe(1_500);

    const withHistory = applyTimelineEditorCommandWithHistory(
      document,
      selection,
      createTimelineEditorHistory(),
      { type: "delete-selection" },
    );
    const undo = undoTimelineEditorHistory(withHistory.history);

    expect(withHistory.document.tracks[0]?.items).toHaveLength(1);
    expect(undo.document?.tracks[0]?.items).toHaveLength(2);

    expect(rippleDeleteTimelineEditorItems(document.tracks, ["brief"])[0]?.items[0]).toEqual(
      expect.objectContaining({ id: "draft", startMs: 2_000 }),
    );
    expect(closeTimelineEditorGap(document.tracks, "planning", 2_000, 3_000)[0]?.items[1]).toEqual(
      expect.objectContaining({ id: "draft", startMs: 2_000 }),
    );
  });
});

describe("@moritzbrantner/timeline-editor React workbench", () => {
  test("renders, selects, scrubs, moves items, and respects read-only mode", () => {
    const document: TimelineEditorDocument = {
      tracks,
      durationMs: 8_000,
      currentTimeMs: 1_000,
      markers: [{ id: "handoff", timeMs: 4_000, label: "Handoff" }],
    };
    const handleDocumentChange = vi.fn();
    const handleCurrentTimeChange = vi.fn();
    const handleSelectedItemChange = vi.fn();
    const { container, rerender } = render(
      <TimelineWorkbench
        document={document}
        selectedItemId="brief"
        assets={[{ id: "asset", label: "Review note", kind: "review", durationMs: 1_000 }]}
        onDocumentChange={handleDocumentChange}
        onCurrentTimeChange={handleCurrentTimeChange}
        onSelectedItemChange={handleSelectedItemChange}
      />,
    );

    const item = screen.getAllByRole("button", { name: "Brief" })[0]!;
    fireEvent.pointerDown(item, { clientX: 0 });
    expect(handleSelectedItemChange).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: "brief" }),
    );

    fireEvent.pointerDown(container.querySelector("[data-slot='timeline-editor-ruler']")!, {
      clientX: 240,
    });
    expect(handleCurrentTimeChange).toHaveBeenCalled();

    fireEvent.pointerMove(container.querySelector("[data-slot='timeline-editor']")!, {
      clientX: 80,
    });
    expect(handleDocumentChange).toHaveBeenCalled();

    handleDocumentChange.mockClear();
    rerender(
      <TimelineWorkbench
        document={document}
        selectedItemId="brief"
        readOnly
        onDocumentChange={handleDocumentChange}
      />,
    );
    fireEvent.pointerDown(screen.getAllByRole("button", { name: "Brief" })[0]!, { clientX: 0 });
    fireEvent.pointerMove(container.querySelector("[data-slot='timeline-editor']")!, {
      clientX: 80,
    });
    expect(handleDocumentChange).not.toHaveBeenCalled();
  });
});
