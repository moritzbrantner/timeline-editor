import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, test, vi } from "vitest";

import {
  TimelineWorkbench,
  clampTimelineEditorTime,
  detectTimelineEditorOverlaps,
  duplicateTimelineEditorItem,
  findTimelineEditorItem,
  formatTimelineEditorTimeMs,
  fromUiTimelineEditorTracks,
  moveTimelineEditorItem,
  normalizeTimelineEditorTracks,
  removeTimelineEditorItem,
  resizeTimelineEditorItem,
  splitTimelineEditorItem,
  toUiTimelineEditorTracks,
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

    const moved = moveTimelineEditorItem(
      tracks,
      { itemId: "brief", startMs: -200, trackId: "review" },
      { durationMs: 10_000 },
    );

    expect(moved[0]?.items[0]?.trackId).toBe("planning");

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

  test("roundtrips timeline tracks through the UI adapter", () => {
    const uiTracks = toUiTimelineEditorTracks(tracks);
    const roundtrip = fromUiTimelineEditorTracks(
      [
        {
          ...uiTracks[0]!,
          clips: [{ ...uiTracks[0]!.clips[0]!, start: 2, end: 4 }],
        },
      ],
      tracks,
    );

    expect(roundtrip[0]?.items[0]).toEqual(
      expect.objectContaining({ id: "brief", startMs: 2_000, durationMs: 2_000 }),
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
