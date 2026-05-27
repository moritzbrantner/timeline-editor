import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, test, vi } from "vitest";

import {
  TimelineWorkbench,
  applyTimelineEditorTransformEasing,
  applyTimelineEditorCommand,
  applyTimelineEditorCommandWithHistory,
  clampTimelineEditorTime,
  closeTimelineEditorGap,
  createTimelineEditorSnapResolver,
  createTimelineEditorClipboard,
  createTimelineEditorHistory,
  detectTimelineEditorOverlaps,
  duplicateTimelineEditorItem,
  findTimelineEditorItem,
  formatTimelineEditorTimeMs,
  getTimelineEditorFrameDurationMs,
  getTimelineEditorItemTransformValuesAt,
  getTimelineEditorTicks,
  getTimelineEditorTransformValuesAt,
  getVisibleTimelineEditorTicksForRange,
  insertTimelineEditorItem,
  migrateTimelineEditorDocument,
  moveTimelineEditorItem,
  normalizeTimelineEditorTracks,
  parseTimelineEditorDocument,
  removeTimelineEditorItem,
  resizeTimelineEditorItem,
  rippleDeleteTimelineEditorItems,
  serializeTimelineEditorDocument,
  setTimelineEditorItemTransform,
  splitTimelineEditorItem,
  TimelineEditor,
  undoTimelineEditorHistory,
  validateTimelineEditorDocument,
  type TimelineEditorDocument,
  type TimelineEditorExtension,
  type TimelineEditorTrack,
} from "@moritzbrantner/timeline-editor";
import {
  createTimelineAudioExtension,
  type TimelineAudioItemData,
} from "@moritzbrantner/timeline-editor/audio";
import {
  createTimelineNumericDataExtension,
  type TimelineNumericDataItemData,
} from "@moritzbrantner/timeline-editor/data";
import {
  createTimelineImageExtension,
  type TimelineImageItemData,
} from "@moritzbrantner/timeline-editor/image";
import {
  createTimelineTextExtension,
  type TimelineTextItemData,
} from "@moritzbrantner/timeline-editor/text";
import {
  createTimelineVideoExtension,
  type TimelineVideoItemData,
} from "@moritzbrantner/timeline-editor/video";

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

function firePointerEvent(element: Element, type: string, clientX: number, clientY = 0) {
  fireEvent(element, new MouseEvent(type, { bubbles: true, clientX, clientY }));
}

function mockTimelineEditorScrollSize(options: { clientWidth: number; scrollWidth: number }) {
  const clientWidth = vi
    .spyOn(HTMLElement.prototype, "clientWidth", "get")
    .mockImplementation(function getClientWidth(this: HTMLElement) {
      return this.dataset["slot"] === "timeline-editor" ? options.clientWidth : 0;
    });
  const scrollWidth = vi
    .spyOn(HTMLElement.prototype, "scrollWidth", "get")
    .mockImplementation(function getScrollWidth(this: HTMLElement) {
      return this.dataset["slot"] === "timeline-editor" ? options.scrollWidth : 0;
    });

  return () => {
    clientWidth.mockRestore();
    scrollWidth.mockRestore();
  };
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
    expect(getTimelineEditorFrameDurationMs(25)).toBe(40);
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

  test("enforces typed track placement", () => {
    const typedTracks: TimelineEditorTrack[] = [
      {
        id: "video",
        label: "Video",
        kind: "video",
        items: [],
      },
      {
        id: "audio",
        label: "Audio",
        kind: "audio",
        items: [],
      },
    ];
    const videoItem = {
      id: "scene",
      trackId: "video",
      label: "Scene",
      kind: "video",
      startMs: 0,
      durationMs: 1_000,
    };

    expect(
      insertTimelineEditorItem(typedTracks, { ...videoItem, id: "voice", kind: "audio" }),
    ).toBe(typedTracks);

    const withVideo = insertTimelineEditorItem(typedTracks, videoItem);
    expect(withVideo[0]?.items[0]).toEqual(expect.objectContaining({ id: "scene" }));
    expect(
      moveTimelineEditorItem(withVideo, {
        itemId: "scene",
        trackId: "audio",
      }),
    ).toBe(withVideo);

    const changedKind = applyTimelineEditorCommand(
      { tracks: withVideo },
      { itemIds: ["scene"] },
      { type: "update-item", itemId: "scene", patch: { kind: "audio" } },
    );
    expect(changedKind.changed).toBe(false);
    expect(changedKind.document.tracks[0]?.items[0]?.kind).toBe("video");

    const changedTrackKind = applyTimelineEditorCommand(
      { tracks: withVideo },
      { itemIds: [] },
      { type: "update-track", trackId: "video", patch: { kind: "audio" } },
    );
    expect(changedTrackKind.changed).toBe(false);
    expect(changedTrackKind.document.tracks[0]?.kind).toBe("video");

    const addedIncompatibleTrack = applyTimelineEditorCommand(
      { tracks: [] },
      { itemIds: [] },
      {
        type: "add-track",
        track: {
          id: "video",
          label: "Video",
          kind: "video",
          items: [{ ...videoItem, kind: "audio" }],
        },
      },
    );
    expect(addedIncompatibleTrack.changed).toBe(false);
    expect(addedIncompatibleTrack.document.tracks).toEqual([]);

    expect(
      validateTimelineEditorDocument({ tracks: [{ ...withVideo[0]!, locked: true }] }),
    ).toEqual([]);

    expect(
      validateTimelineEditorDocument({
        tracks: [
          {
            ...typedTracks[0]!,
            items: [{ ...videoItem, kind: "audio" }],
          },
        ],
      }),
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "incompatible_track_kind" })]),
    );

    const restored = parseTimelineEditorDocument(
      serializeTimelineEditorDocument({ tracks: withVideo }),
    );
    expect(restored.tracks[0]?.kind).toBe("video");
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

  test("enforces prevent and push overlap policies", () => {
    const overlappingTracks: TimelineEditorTrack[] = [
      {
        id: "planning",
        label: "Planning",
        items: [
          { id: "brief", trackId: "planning", label: "Brief", startMs: 0, durationMs: 1_000 },
          { id: "draft", trackId: "planning", label: "Draft", startMs: 1_500, durationMs: 1_000 },
          {
            id: "review",
            trackId: "planning",
            label: "Review",
            startMs: 2_400,
            durationMs: 1_000,
          },
        ],
      },
    ];

    const prevented = moveTimelineEditorItem(
      overlappingTracks,
      { itemId: "brief", startMs: 1_000 },
      { durationMs: 5_000, editPolicy: { overlap: "prevent", ripple: false } },
    );
    expect(prevented).toBe(overlappingTracks);

    const allowed = moveTimelineEditorItem(
      overlappingTracks,
      { itemId: "brief", startMs: 1_000 },
      { durationMs: 5_000, editPolicy: { overlap: "allow", ripple: false } },
    );
    expect(allowed).not.toBe(overlappingTracks);
    expect(detectTimelineEditorOverlaps(allowed)).toHaveLength(2);

    const pushed = moveTimelineEditorItem(
      overlappingTracks,
      { itemId: "brief", startMs: 1_000 },
      { durationMs: 5_000, editPolicy: { overlap: "push", ripple: false } },
    );

    expect(pushed[0]?.items).toEqual([
      expect.objectContaining({ id: "brief", startMs: 1_000 }),
      expect.objectContaining({ id: "draft", startMs: 2_000 }),
      expect.objectContaining({ id: "review", startMs: 3_000 }),
    ]);
    expect(detectTimelineEditorOverlaps(pushed)).toHaveLength(0);

    const lockedBlock = moveTimelineEditorItem(
      [
        {
          ...overlappingTracks[0]!,
          items: [
            overlappingTracks[0]!.items[0]!,
            { ...overlappingTracks[0]!.items[1]!, locked: true },
          ],
        },
      ],
      { itemId: "brief", startMs: 1_000 },
      { durationMs: 5_000, editPolicy: { overlap: "push", ripple: false } },
    );
    expect(lockedBlock[0]?.items[0]?.startMs).toBe(0);

    const inserted = insertTimelineEditorItem(
      overlappingTracks,
      {
        id: "inserted",
        trackId: "planning",
        label: "Inserted",
        startMs: 1_000,
        durationMs: 1_000,
      },
      { durationMs: 5_000, editPolicy: { overlap: "push", ripple: false } },
    );

    expect(inserted[0]?.items).toEqual([
      expect.objectContaining({ id: "brief", startMs: 0 }),
      expect.objectContaining({ id: "inserted", startMs: 1_000 }),
      expect.objectContaining({ id: "draft", startMs: 2_000 }),
      expect.objectContaining({ id: "review", startMs: 3_000 }),
    ]);
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
    expect(
      getVisibleTimelineEditorTicksForRange(
        60_000,
        { pixelsPerSecond: 80 },
        { startMs: 12_250, endMs: 14_250 },
      ),
    ).toEqual([
      { timeMs: 12_000, label: "0:12.0", major: false },
      { timeMs: 13_000, label: "0:13.0", major: false },
      { timeMs: 14_000, label: "0:14.0", major: false },
      { timeMs: 15_000, label: "0:15.0", major: true },
    ]);
    expect(
      getVisibleTimelineEditorTicksForRange(
        2_000,
        { pixelsPerSecond: 80 },
        { startMs: 0, endMs: 240 },
        40,
      ),
    ).toEqual([
      { timeMs: 0, label: "0:00.0", major: true },
      { timeMs: 120, label: "0:00.1", major: false },
      { timeMs: 240, label: "0:00.2", major: false },
    ]);
  });

  test("reports document, marker, group, and transform validation issues", () => {
    const issues = validateTimelineEditorDocument({
      durationMs: 1_000,
      currentTimeMs: 1_500,
      markers: [{ id: "late", timeMs: 1_500 }],
      groups: [{ id: "group", label: "Group", trackIds: ["planning", "planning"] }],
      itemGroups: [{ id: "pair", label: "Pair", itemIds: ["brief", "brief"] }],
      tracks: [
        {
          id: "planning",
          label: "Planning",
          height: 0,
          items: [
            {
              id: "brief",
              trackId: "planning",
              label: "Brief",
              startMs: 0,
              durationMs: 1_000,
              itemGroupId: "pair",
              transform: {
                points: [
                  { offsetMs: 0, values: { x: 0 } },
                  { offsetMs: 0, values: { x: 1 } },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "current_time_exceeds_duration",
        "invalid_track_height",
        "duplicate_transform_offset",
        "duplicate_group_track",
        "duplicate_item_group_item",
        "marker_exceeds_duration",
      ]),
    );
  });

  test("attaches, samples, serializes, and splits item transforms", () => {
    const transformed = setTimelineEditorItemTransform(tracks, "brief", {
      points: [
        { offsetMs: 2_000, values: { x: 100, opacity: 0 } },
        { offsetMs: 0, values: { x: 0, opacity: 1 } },
      ],
    });
    const item = transformed[0]!.items[0]!;

    expect(getTimelineEditorItemTransformValuesAt(item, 2_000)).toEqual({
      x: 50,
      opacity: 0.5,
    });
    expect(getTimelineEditorTransformValuesAt(item.transform, 3_000, item.durationMs)).toEqual({
      x: 100,
      opacity: 0,
    });

    const serialized = serializeTimelineEditorDocument({ tracks: transformed });
    expect(parseTimelineEditorDocument(serialized).tracks[0]?.items[0]?.transform?.points).toEqual([
      { offsetMs: 0, values: { x: 0, opacity: 1 }, easing: undefined },
      { offsetMs: 2_000, values: { x: 100, opacity: 0 }, easing: undefined },
    ]);

    const split = splitTimelineEditorItem(transformed, { itemId: "brief", timeMs: 2_000 });

    expect(split[0]?.items[0]?.transform?.points).toEqual([
      { offsetMs: 0, values: { x: 0, opacity: 1 } },
      { offsetMs: 1_000, values: { x: 50, opacity: 0.5 } },
    ]);
    expect(split[0]?.items[1]?.transform?.points).toEqual([
      { offsetMs: 0, values: { x: 50, opacity: 0.5 } },
      { offsetMs: 1_000, values: { x: 100, opacity: 0 } },
    ]);
  });

  test("samples transform points with easing curves", () => {
    const transformed = setTimelineEditorItemTransform(tracks, "brief", {
      points: [
        { offsetMs: 0, values: { x: 0 }, easing: "cubic" },
        { offsetMs: 2_000, values: { x: 100 }, easing: "hold" },
      ],
    });
    const item = transformed[0]!.items[0]!;

    expect(getTimelineEditorTransformValuesAt(item.transform, 500, item.durationMs)).toEqual({
      x: 6.25,
    });
    expect(applyTimelineEditorTransformEasing("cubic-in", 0.5)).toBe(0.125);
    expect(applyTimelineEditorTransformEasing("cubic-out", 0.5)).toBe(0.875);
    expect(
      parseTimelineEditorDocument(serializeTimelineEditorDocument({ tracks: transformed }))
        .tracks[0]?.items[0]?.transform?.points[0]?.easing,
    ).toBe("cubic");
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

    const rippleDeleted = applyTimelineEditorCommand(
      document,
      selection,
      { type: "delete-selection" },
      { editPolicy: { overlap: "allow", ripple: true } },
    );
    expect(rippleDeleted.document.tracks[0]?.items[0]).toEqual(
      expect.objectContaining({ id: "draft", startMs: 2_000 }),
    );

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

  test("applies workbench document commands through the command reducer", () => {
    const document: TimelineEditorDocument = { tracks: [], durationMs: 8_000 };
    const selection = { itemIds: [] };
    const withTrack = applyTimelineEditorCommand(
      document,
      selection,
      { type: "add-track", track: { id: "planning", label: "Planning" } },
      { durationMs: 8_000 },
    );

    expect(withTrack.changed).toBe(true);
    expect(withTrack.document.tracks[0]).toEqual({ id: "planning", label: "Planning", items: [] });

    const withItem = applyTimelineEditorCommandWithHistory(
      withTrack.document,
      withTrack.selection,
      createTimelineEditorHistory(),
      {
        type: "insert-item",
        item: {
          id: "brief",
          trackId: "planning",
          label: "Brief",
          startMs: 1_000,
          durationMs: 2_000,
        },
      },
      { durationMs: 8_000 },
    );

    expect(withItem.selection).toEqual({ itemIds: ["brief"], anchorItemId: "brief" });
    expect(withItem.history.undoStack).toHaveLength(1);
    expect(undoTimelineEditorHistory(withItem.history).document?.tracks[0]?.items).toHaveLength(0);

    const updated = applyTimelineEditorCommand(
      withItem.document,
      withItem.selection,
      { type: "update-item", itemId: "brief", patch: { label: "Updated brief" } },
      { durationMs: 8_000 },
    );
    expect(updated.document.tracks[0]?.items[0]?.label).toBe("Updated brief");

    const withMarker = applyTimelineEditorCommand(updated.document, updated.selection, {
      type: "add-marker",
      marker: { id: "handoff", timeMs: 4_000, label: "Handoff" },
    });
    expect(withMarker.document.markers).toEqual([
      { id: "handoff", timeMs: 4_000, label: "Handoff" },
    ]);

    const withoutTrack = applyTimelineEditorCommand(withMarker.document, withMarker.selection, {
      type: "remove-track",
      trackId: "planning",
    });
    expect(withoutTrack.document.tracks).toHaveLength(0);
    expect(withoutTrack.selection).toEqual({ itemIds: [] });
  });

  test("copies, cuts, pastes, ranges, markers, and tracks through commands", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 1_000,
      markers: [{ id: "handoff", timeMs: 4_000, label: "Handoff" }],
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
    const copied = applyTimelineEditorCommand(document, selection, { type: "copy-selection" });

    expect(copied.clipboard).toEqual(createTimelineEditorClipboard(document.tracks, ["brief"]));

    const cut = applyTimelineEditorCommand(document, selection, { type: "cut-selection" });
    expect(cut.document.tracks[0]?.items.map((item) => item.id)).toEqual(["draft"]);
    expect(cut.clipboard?.items[0]?.id).toBe("brief");

    const pasted = applyTimelineEditorCommand(
      document,
      { itemIds: [] },
      { type: "paste-items", clipboard: copied.clipboard!, timeMs: 5_000 },
    );
    expect(pasted.document.tracks[0]?.items.at(-1)).toEqual(
      expect.objectContaining({ id: "brief-copy", startMs: 5_000 }),
    );
    expect(pasted.selection.itemIds).toEqual(["brief-copy"]);

    const withoutRange = applyTimelineEditorCommand(document, selection, {
      type: "delete-range",
      range: { startMs: 2_500, endMs: 4_500 },
    });
    expect(withoutRange.document.tracks[0]?.items.map((item) => item.id)).toEqual(["brief"]);

    const markerUpdated = applyTimelineEditorCommand(document, selection, {
      type: "update-marker",
      markerId: "handoff",
      patch: { label: "Updated", timeMs: 4_500 },
    });
    expect(markerUpdated.document.markers?.[0]).toEqual(
      expect.objectContaining({ label: "Updated", timeMs: 4_500 }),
    );

    const trackUpdated = applyTimelineEditorCommand(document, selection, {
      type: "update-track",
      trackId: "planning",
      patch: { label: "Plan", locked: true },
    });
    expect(trackUpdated.document.tracks[0]).toEqual(
      expect.objectContaining({ label: "Plan", locked: true }),
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

  test("moves timeline items across compatible tracks during drag", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks: [
        {
          id: "planning",
          label: "Planning",
          items: [
            { id: "brief", trackId: "planning", label: "Brief", startMs: 1_000, durationMs: 500 },
          ],
        },
        {
          id: "review",
          label: "Review",
          items: [],
        },
      ],
    };
    const handleDocumentChange = vi.fn();
    const { container } = render(
      <TimelineEditor
        document={document}
        selection={{ itemIds: ["brief"], anchorItemId: "brief" }}
        viewport={{ pixelsPerSecond: 80 }}
        onDocumentChange={handleDocumentChange}
      />,
    );
    const editor = container.querySelector("[data-slot='timeline-editor']")!;

    firePointerEvent(screen.getByRole("button", { name: "Brief" }), "pointerdown", 0, 50);
    firePointerEvent(editor, "pointermove", 0, 106);
    firePointerEvent(editor, "pointerup", 0, 106);

    expect(handleDocumentChange).toHaveBeenCalledTimes(1);
    expect(handleDocumentChange.mock.calls[0]?.[0].tracks).toEqual([
      expect.objectContaining({ id: "planning", items: [] }),
      expect.objectContaining({
        id: "review",
        items: [expect.objectContaining({ id: "brief", trackId: "review", startMs: 1_000 })],
      }),
    ]);
  });

  test("applies edit policy to pointer drag commits", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks: [
        {
          id: "planning",
          label: "Planning",
          items: [
            { id: "brief", trackId: "planning", label: "Brief", startMs: 1_000, durationMs: 2_000 },
            { id: "draft", trackId: "planning", label: "Draft", startMs: 3_500, durationMs: 1_000 },
          ],
        },
      ],
    };
    const handleDocumentChange = vi.fn();
    const { container } = render(
      <TimelineEditor
        document={document}
        editPolicy={{ overlap: "prevent", ripple: false }}
        selection={{ itemIds: ["brief"], anchorItemId: "brief" }}
        viewport={{ pixelsPerSecond: 80 }}
        onDocumentChange={handleDocumentChange}
      />,
    );
    const editor = container.querySelector("[data-slot='timeline-editor']")!;

    firePointerEvent(screen.getByRole("button", { name: "Brief" }), "pointerdown", 0);
    firePointerEvent(editor, "pointermove", 160);
    firePointerEvent(editor, "pointerup", 160);

    expect(handleDocumentChange).not.toHaveBeenCalled();
  });

  test("nudges timeline items by frame duration when a framerate is set", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks,
    };
    const handleDocumentChange = vi.fn();
    const { container } = render(
      <TimelineEditor
        document={document}
        selection={{ itemIds: ["brief"], anchorItemId: "brief" }}
        viewport={{ pixelsPerSecond: 80 }}
        frameRate={25}
        onDocumentChange={handleDocumentChange}
      />,
    );
    const editor = container.querySelector("[data-slot='timeline-editor']")!;

    fireEvent.keyDown(editor, { key: "ArrowRight" });

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tracks: [
          expect.objectContaining({
            items: [expect.objectContaining({ id: "brief", startMs: 1_040 })],
          }),
          expect.anything(),
        ],
      }),
    );
  });

  test("steps the playhead by frame duration when no timeline item is selected", () => {
    const document: TimelineEditorDocument = {
      currentTimeMs: 1_000,
      durationMs: 8_000,
      tracks,
    };
    const handleDocumentChange = vi.fn();
    const handleCurrentTimeChange = vi.fn();
    const { container } = render(
      <TimelineEditor
        document={document}
        selection={{ itemIds: [] }}
        viewport={{ pixelsPerSecond: 80 }}
        frameRate={25}
        onCurrentTimeChange={handleCurrentTimeChange}
        onDocumentChange={handleDocumentChange}
      />,
    );
    const editor = container.querySelector("[data-slot='timeline-editor']")!;

    fireEvent.keyDown(editor, { key: "ArrowRight" });

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({ currentTimeMs: 1_040 }),
    );
    expect(handleCurrentTimeChange).toHaveBeenCalledWith(1_040);
  });

  test("renders frame ticks through timeline tracks", () => {
    const document: TimelineEditorDocument = {
      durationMs: 2_000,
      tracks,
    };
    const { container } = render(
      <TimelineEditor
        document={document}
        selection={{ itemIds: [] }}
        viewport={{ pixelsPerSecond: 80 }}
        frameRate={25}
      />,
    );

    expect(
      container.querySelectorAll("[data-slot='timeline-editor-track-tick']").length,
    ).toBeGreaterThan(0);
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

    fireEvent.pointerDown(container.querySelector("[data-slot='timeline-editor-ruler-lane']")!, {
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

  test("adds typed tracks from the workbench add track menu", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks,
    };
    const handleDocumentChange = vi.fn();

    render(
      <TimelineWorkbench
        document={document}
        assets={[{ id: "asset", label: "Review note", kind: "review", durationMs: 1_000 }]}
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "Add Track" }), { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Review Track" }));

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tracks: [
          expect.anything(),
          expect.anything(),
          expect.objectContaining({
            id: "review-track-3",
            label: "Review Track 3",
            kind: "review",
            acceptsItemKinds: ["review"],
          }),
        ],
      }),
    );
  });

  test("applies workbench edit policy to asset insertion", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 1_500,
      tracks: [
        {
          id: "planning",
          label: "Planning",
          items: [
            { id: "brief", trackId: "planning", label: "Brief", startMs: 1_000, durationMs: 2_000 },
          ],
        },
      ],
    };
    const handleDocumentChange = vi.fn();

    render(
      <TimelineWorkbench
        document={document}
        editPolicy={{ overlap: "prevent", ripple: false }}
        assets={[{ id: "asset", label: "Review note", durationMs: 1_000 }]}
        renderAsset={(asset) => asset.label}
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Review note" })[0]!);

    expect(handleDocumentChange).not.toHaveBeenCalled();
  });

  test("supports controlled workbench viewport changes", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks,
    };
    const handleViewportChange = vi.fn();
    const { container, rerender } = render(
      <TimelineWorkbench
        document={document}
        viewport={{ pixelsPerSecond: 80 }}
        onViewportChange={handleViewportChange}
      />,
    );
    const getEditorContentWidth = () =>
      container.querySelector<HTMLElement>("[data-slot='timeline-editor'] > div")?.style.width;

    expect(getEditorContentWidth()).toBe("784px");

    rerender(
      <TimelineWorkbench
        document={document}
        viewport={{ pixelsPerSecond: 160 }}
        onViewportChange={handleViewportChange}
      />,
    );

    expect(getEditorContentWidth()).toBe("1424px");

    fireEvent.wheel(container.querySelector("[data-slot='timeline-editor']")!, {
      clientX: 100,
      ctrlKey: true,
      deltaY: -120,
    });
    expect(handleViewportChange).toHaveBeenCalledWith(
      expect.objectContaining({ pixelsPerSecond: 176 }),
    );
  });

  test("applies controlled timeline scrollLeftMs to the scroller", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks,
    };
    const restoreScrollSize = mockTimelineEditorScrollSize({ clientWidth: 320, scrollWidth: 784 });

    try {
      const { container, rerender } = render(
        <TimelineEditor
          document={document}
          viewport={{ pixelsPerSecond: 80, scrollLeftMs: 2_000 }}
        />,
      );
      const editor = container.querySelector<HTMLElement>("[data-slot='timeline-editor']")!;

      expect(editor.scrollLeft).toBe(304);

      rerender(
        <TimelineEditor
          document={document}
          viewport={{ pixelsPerSecond: 80, scrollLeftMs: 3_000 }}
        />,
      );

      expect(editor.scrollLeft).toBe(384);
    } finally {
      restoreScrollSize();
    }
  });

  test("reports timeline scrollLeftMs when the scroller moves", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks,
    };
    const handleViewportChange = vi.fn();
    const restoreScrollSize = mockTimelineEditorScrollSize({ clientWidth: 320, scrollWidth: 784 });

    try {
      const { container } = render(
        <TimelineEditor
          document={document}
          viewport={{ pixelsPerSecond: 80 }}
          onViewportChange={handleViewportChange}
        />,
      );
      const editor = container.querySelector<HTMLElement>("[data-slot='timeline-editor']")!;

      editor.scrollLeft = 304;
      fireEvent.scroll(editor);

      expect(handleViewportChange).toHaveBeenCalledWith(
        expect.objectContaining({ pixelsPerSecond: 80, scrollLeftMs: 2_000 }),
      );
    } finally {
      restoreScrollSize();
    }
  });

  test("prevents ctrl-wheel browser default and reports zoom changes", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks,
    };
    const handleViewportChange = vi.fn();
    const restoreScrollSize = mockTimelineEditorScrollSize({ clientWidth: 320, scrollWidth: 784 });

    try {
      const { container } = render(
        <TimelineEditor
          document={document}
          viewport={{ pixelsPerSecond: 80 }}
          onViewportChange={handleViewportChange}
        />,
      );
      const editor = container.querySelector<HTMLElement>("[data-slot='timeline-editor']")!;
      const event = new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        ctrlKey: true,
        deltaY: -120,
      });

      expect(editor.dispatchEvent(event)).toBe(false);
      expect(event.defaultPrevented).toBe(true);
      expect(handleViewportChange).toHaveBeenCalledWith(
        expect.objectContaining({ pixelsPerSecond: 96 }),
      );
    } finally {
      restoreScrollSize();
    }
  });

  test("uses deterministic workbench item and marker ids when provided", () => {
    const document: TimelineEditorDocument = {
      durationMs: 8_000,
      currentTimeMs: 1_000,
      tracks,
    };
    const handleDocumentChange = vi.fn();

    render(
      <TimelineWorkbench
        document={document}
        assets={[{ id: "asset", label: "Review note", kind: "review", durationMs: 1_000 }]}
        createItemId={() => "review-note-fixed"}
        createMarkerId={() => "marker-fixed"}
        renderAsset={(asset) => asset.label}
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Review note" })[0]!);
    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tracks: [
          expect.objectContaining({
            items: expect.arrayContaining([expect.objectContaining({ id: "review-note-fixed" })]),
          }),
          expect.anything(),
        ],
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Marker" }));
    expect(handleDocumentChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        markers: [expect.objectContaining({ id: "marker-fixed", timeMs: 1_000 })],
      }),
    );
  });

  test("renders display-only media extensions and preserves media data", () => {
    type MediaItemData =
      | TimelineAudioItemData
      | TimelineVideoItemData
      | TimelineImageItemData
      | TimelineTextItemData
      | TimelineNumericDataItemData;

    const document: TimelineEditorDocument<Record<string, unknown>, MediaItemData> = {
      durationMs: 8_000,
      currentTimeMs: 2_500,
      tracks: [
        {
          id: "text",
          label: "Text",
          acceptsItemKinds: ["text", "caption", "subtitle"],
          items: [
            {
              id: "subtitle",
              trackId: "text",
              label: "Subtitle",
              kind: "subtitle",
              startMs: 1_000,
              durationMs: 3_000,
              data: {
                mediaType: "text",
                format: "ass-like",
                language: "en",
                cues: [
                  { startMs: 0, endMs: 1_000, text: "Intro line", styleName: "Default" },
                  { startMs: 1_001, endMs: 2_200, text: "Middle line", styleName: "Default" },
                ],
              },
            },
          ],
        },
        {
          id: "audio",
          label: "Audio",
          acceptsItemKinds: ["audio"],
          items: [
            {
              id: "voice",
              trackId: "audio",
              label: "Voiceover",
              kind: "audio",
              startMs: 0,
              durationMs: 4_000,
              data: {
                mediaType: "audio",
                muted: true,
                source: { label: "voice.wav" },
                waveform: [0.1, 0.5, 0.9, 0.3],
              },
            },
          ],
        },
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
              startMs: 0,
              durationMs: 4_000,
              data: {
                mediaType: "video",
                source: { label: "scene.mp4" },
                thumbnails: ["thumb-1.png", "thumb-2.png"],
              },
            },
          ],
        },
        {
          id: "image",
          label: "Image",
          acceptsItemKinds: ["image"],
          items: [
            {
              id: "poster",
              trackId: "image",
              label: "Poster",
              kind: "image",
              startMs: 1_000,
              durationMs: 2_000,
              data: {
                mediaType: "image",
                thumbnail: "poster-thumb.png",
                width: 1920,
                height: 1080,
              },
            },
          ],
        },
        {
          id: "data",
          label: "Data",
          acceptsItemKinds: ["data", "numeric-data"],
          items: [
            {
              id: "telemetry",
              trackId: "data",
              label: "Telemetry",
              kind: "numeric-data",
              startMs: 0,
              durationMs: 4_000,
              data: {
                mediaType: "numeric-data",
                series: [
                  {
                    label: "Speed",
                    unit: "km/h",
                    points: [
                      { timeMs: 0, value: 0 },
                      { timeMs: 1_000, value: 25 },
                      { timeMs: 2_000, value: 10 },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const handleDocumentChange = vi.fn();
    const extensions = [
      createTimelineTextExtension(),
      createTimelineAudioExtension(),
      createTimelineVideoExtension(),
      createTimelineImageExtension(),
      createTimelineNumericDataExtension(),
    ] as Array<TimelineEditorExtension<MediaItemData>>;

    const { container } = render(
      <TimelineWorkbench
        document={document}
        selection={{ itemIds: ["subtitle"], anchorItemId: "subtitle" }}
        assets={[
          {
            id: "music",
            label: "Music",
            kind: "audio",
            durationMs: 2_000,
            data: {
              mediaType: "audio",
              source: { label: "music.wav" },
              waveform: [0.2, 0.8],
            } satisfies TimelineAudioItemData,
          },
        ]}
        extensions={extensions}
        onDocumentChange={handleDocumentChange}
      />,
    );

    expect(screen.getByText("Middle line")).toBeTruthy();
    expect(container.querySelector("[data-slot='timeline-media-audio-waveform']")).toBeTruthy();
    expect(container.querySelector("[data-slot='timeline-media-video-thumbnails']")).toBeTruthy();
    expect(container.querySelector("[data-slot='timeline-media-image-thumbnail']")).toBeTruthy();
    expect(container.querySelector("[data-slot='timeline-media-numeric-sparkline']")).toBeTruthy();

    const parsed = parseTimelineEditorDocument(serializeTimelineEditorDocument(document));
    expect(parsed.tracks[0]?.items[0]?.data).toEqual(document.tracks[0]?.items[0]?.data);
    expect(parsed.tracks[4]?.items[0]?.data).toEqual(document.tracks[4]?.items[0]?.data);

    fireEvent.click(screen.getAllByRole("button", { name: /Music/ })[0]!);

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tracks: expect.arrayContaining([
          expect.objectContaining({
            id: "audio",
            items: expect.arrayContaining([
              expect.objectContaining({
                kind: "audio",
                data: expect.objectContaining({
                  mediaType: "audio",
                  source: { label: "music.wav" },
                }),
              }),
            ]),
          }),
        ]),
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

  test("runs workbench item commands from the context menu", async () => {
    let document: TimelineEditorDocument = {
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
            {
              id: "overlay",
              trackId: "video",
              label: "Overlay",
              kind: "video",
              startMs: 3_000,
              durationMs: 1_000,
            },
          ],
        },
      ],
    };
    const selection = { itemIds: ["scene", "overlay"], anchorItemId: "scene" };
    const handleDocumentChange = vi.fn((nextDocument: TimelineEditorDocument) => {
      document = nextDocument;
    });
    const renderWorkbench = () => (
      <TimelineWorkbench
        document={document}
        selection={selection}
        onDocumentChange={handleDocumentChange}
      />
    );

    const { container, rerender } = render(renderWorkbench());

    fireEvent.contextMenu(container.querySelector("[data-slot='timeline-editor-clip']")!);

    expect(await screen.findByRole("menuitem", { name: "Split at playhead" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeTruthy();

    fireEvent.click(screen.getByRole("menuitem", { name: "Group" }));

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        itemGroups: [expect.objectContaining({ itemIds: ["scene", "overlay"] })],
      }),
    );

    rerender(renderWorkbench());
    fireEvent.contextMenu(container.querySelector("[data-slot='timeline-editor-clip']")!);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Ungroup" }));

    expect(handleDocumentChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        itemGroups: undefined,
        tracks: [
          expect.objectContaining({
            items: [
              expect.objectContaining({ id: "scene", itemGroupId: undefined }),
              expect.objectContaining({ id: "overlay", itemGroupId: undefined }),
            ],
          }),
        ],
      }),
    );
  });
});
