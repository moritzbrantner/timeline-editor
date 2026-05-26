import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, test, vi } from "vitest";

import {
  TimelineWorkbench,
  applyTimelineEditorCommand,
  applyTimelineEditorCommandWithHistory,
  clampTimelineEditorTime,
  closeTimelineEditorGap,
  createTimelineEditorSnapResolver,
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
  TimelineEditor,
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

function firePointerEvent(element: Element, type: string, clientX: number) {
  fireEvent(element, new MouseEvent(type, { bubbles: true, clientX }));
}

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

  test("resolves snap targets without enumerating interval candidates", () => {
    const document: TimelineEditorDocument = {
      durationMs: 10_000,
      currentTimeMs: 3_000,
      markers: [{ id: "marker", timeMs: 2_500 }],
      tracks,
    };
    const resolver = createTimelineEditorSnapResolver(
      document,
      {
        enabled: true,
        thresholdPx: 8,
        targets: [
          { type: "interval", intervalMs: 100 },
          { type: "marker" },
          { type: "item-edge" },
          { type: "playhead" },
          { type: "custom", id: "custom", timesMs: [3_750] },
        ],
      },
      100,
    );

    expect(resolver(1_040)).toEqual({ timeMs: 1_000, snapped: true });
    expect(resolver(2_470)).toEqual({ timeMs: 2_500, snapped: true });
    expect(resolver(2_960)).toEqual({ timeMs: 3_000, snapped: true });
    expect(resolver(3_760)).toEqual({ timeMs: 3_750, snapped: true });
    expect(resolver(4_234)).toEqual({ timeMs: 4_200, snapped: true });

    const resolverWithoutOwnEdges = createTimelineEditorSnapResolver(
      document,
      { enabled: true, thresholdPx: 8, targets: [{ type: "item-edge" }] },
      100,
      { excludeItemIds: ["brief"] },
    );

    expect(resolverWithoutOwnEdges(1_040)).toEqual({ timeMs: 1_040, snapped: false });
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
  test("commits drag edits once and undo returns to the pre-drag document", () => {
    const document: TimelineEditorDocument = {
      tracks,
      durationMs: 8_000,
      currentTimeMs: 1_000,
    };
    let currentDocument = document;

    function StatefulWorkbench() {
      const [stateDocument, setStateDocument] = useState(document);
      currentDocument = stateDocument;

      return (
        <TimelineWorkbench
          document={stateDocument}
          selectedItemId="brief"
          onDocumentChange={(nextDocument) => {
            currentDocument = nextDocument;
            setStateDocument(nextDocument);
          }}
        />
      );
    }

    const { container } = render(<StatefulWorkbench />);
    const editor = container.querySelector("[data-slot='timeline-editor']")!;
    const item = screen.getAllByRole("button", { name: "Brief" })[0]!;

    firePointerEvent(item, "pointerdown", 0);
    firePointerEvent(editor, "pointermove", 80);
    expect(currentDocument.tracks[0]?.items[0]?.startMs).toBe(1_000);

    firePointerEvent(editor, "pointerup", 80);
    expect(currentDocument.tracks[0]?.items[0]?.startMs).toBe(2_000);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(currentDocument.tracks[0]?.items[0]?.startMs).toBe(1_000);
  });

  test("moves multi-selection items during a single drag commit", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks: [
        {
          id: "planning",
          label: "Planning",
          items: [
            { id: "brief", trackId: "planning", label: "Brief", startMs: 1_000, durationMs: 500 },
            { id: "draft", trackId: "planning", label: "Draft", startMs: 2_000, durationMs: 500 },
          ],
        },
      ],
    };
    const handleDocumentChange = vi.fn();
    const { container } = render(
      <TimelineEditor
        document={document}
        selection={{ itemIds: ["brief", "draft"], anchorItemId: "brief" }}
        viewport={{ pixelsPerSecond: 80 }}
        onDocumentChange={handleDocumentChange}
      />,
    );
    const editor = container.querySelector("[data-slot='timeline-editor']")!;

    firePointerEvent(screen.getByRole("button", { name: "Brief" }), "pointerdown", 0);
    firePointerEvent(editor, "pointermove", 80);
    expect(handleDocumentChange).not.toHaveBeenCalled();

    firePointerEvent(editor, "pointerup", 80);
    expect(handleDocumentChange).toHaveBeenCalledTimes(1);
    expect(handleDocumentChange.mock.calls[0]?.[0].tracks[0]?.items).toEqual([
      expect.objectContaining({ id: "brief", startMs: 2_000 }),
      expect.objectContaining({ id: "draft", startMs: 3_000 }),
    ]);
  });

  test("filters offscreen timeline items in a large document", () => {
    const largeDocument: TimelineEditorDocument = {
      durationMs: 600_000,
      tracks: Array.from({ length: 50 }, (_, trackIndex) => ({
        id: `track-${trackIndex}`,
        label: `Track ${trackIndex}`,
        items: Array.from({ length: 100 }, (_, itemIndex) => ({
          id: `item-${trackIndex}-${itemIndex}`,
          trackId: `track-${trackIndex}`,
          label: `Item ${trackIndex}-${itemIndex}`,
          startMs: itemIndex * 6_000,
          durationMs: 1_000,
        })),
      })),
    };

    render(
      <TimelineEditor
        document={largeDocument}
        selection={{ itemIds: ["item-49-99"], anchorItemId: "item-49-99" }}
        viewport={{ pixelsPerSecond: 80, visibleStartMs: 0, visibleEndMs: 10_000 }}
      />,
    );

    expect(screen.getByRole("button", { name: "Item 49-99" })).toBeTruthy();
    expect(screen.queryAllByRole("button").length).toBeLessThan(250);
    expect(screen.queryByRole("button", { name: "Item 0-50" })).toBeNull();
  });

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
    firePointerEvent(item, "pointerdown", 0);
    expect(handleSelectedItemChange).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: "brief" }),
    );

    fireEvent.pointerDown(container.querySelector("[data-slot='timeline-editor-ruler']")!, {
      clientX: 240,
    });
    expect(handleCurrentTimeChange).toHaveBeenCalled();

    handleDocumentChange.mockClear();
    firePointerEvent(container.querySelector("[data-slot='timeline-editor']")!, "pointermove", 80);
    expect(handleDocumentChange).not.toHaveBeenCalled();

    firePointerEvent(container.querySelector("[data-slot='timeline-editor']")!, "pointerup", 80);
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
    firePointerEvent(screen.getAllByRole("button", { name: "Brief" })[0]!, "pointerdown", 0);
    firePointerEvent(container.querySelector("[data-slot='timeline-editor']")!, "pointermove", 80);
    expect(handleDocumentChange).not.toHaveBeenCalled();
  });

  test("places assets on compatible tracks when the selected track rejects the media kind", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks: [
        {
          id: "video",
          label: "Video",
          acceptsItemKinds: ["video"],
          items: [],
        },
        {
          id: "audio",
          label: "Audio",
          acceptsItemKinds: ["audio"],
          items: [
            {
              id: "voice",
              trackId: "audio",
              label: "Voice",
              kind: "audio",
              startMs: 1_000,
              durationMs: 1_000,
            },
          ],
        },
      ],
    };
    const handleDocumentChange = vi.fn();

    render(
      <TimelineWorkbench
        document={document}
        selectedItemId="voice"
        assets={[{ id: "clip", label: "Camera", kind: "video", durationMs: 1_000 }]}
        renderAsset={(asset) => asset.label}
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Camera" })[0]!);

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tracks: [
          expect.objectContaining({
            id: "video",
            items: [expect.objectContaining({ label: "Camera", kind: "video", trackId: "video" })],
          }),
          expect.objectContaining({ id: "audio" }),
        ],
      }),
    );
  });

  test("extends timeline item context menus by media kind", async () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks: [
        {
          id: "video",
          label: "Video",
          acceptsItemKinds: ["video"],
          items: [
            {
              id: "scene",
              trackId: "video",
              label: "Scene",
              kind: "video",
              startMs: 1_000,
              durationMs: 1_000,
            },
          ],
        },
      ],
    };
    const handleCustomAction = vi.fn();

    const { container } = render(
      <TimelineWorkbench
        document={document}
        selectedItemId="scene"
        getItemContextMenuItems={(context) =>
          context.mediaType === "video"
            ? [
                {
                  id: "transcode-video",
                  label: "Transcode video",
                  onSelect: () => handleCustomAction(context.item.id),
                },
              ]
            : []
        }
      />,
    );

    fireEvent.contextMenu(container.querySelector("[data-slot='timeline-editor-clip']")!);
    fireEvent.click(await screen.findByText("Transcode video"));

    expect(handleCustomAction).toHaveBeenCalledWith("scene");
  });
});
