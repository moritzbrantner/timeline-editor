import { describe, expect, test } from "vitest";

import {
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
  TimelineEditorMigrationError,
  undoTimelineEditorHistory,
  validateTimelineEditorDocument,
  type TimelineEditorDocument,
  type TimelineEditorTrack,
} from "@moritzbrantner/timeline-editor";
import {
  assertTimelineMediaKindMatchesData,
  getTimelineMediaTypeForItem,
  getTimelineMediaTypeForKind,
  getTimelineMediaTypeFromData,
  validateTimelineEditorMediaTypes,
} from "@moritzbrantner/timeline-editor/media-types";

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

  test("normalizes built-in media types without changing core validation", () => {
    expect(getTimelineMediaTypeForKind("caption")).toBe("text");
    expect(getTimelineMediaTypeForKind("subtitle")).toBe("text");
    expect(getTimelineMediaTypeForKind("data")).toBe("numeric-data");
    expect(getTimelineMediaTypeForKind("annotation")).toBeUndefined();
    expect(getTimelineMediaTypeFromData({ mediaType: "video" })).toBe("video");
    expect(
      getTimelineMediaTypeForItem({
        id: "scene",
        trackId: "video",
        label: "Scene",
        startMs: 0,
        durationMs: 1_000,
        data: { mediaType: "image" },
      }),
    ).toBe("image");

    const mismatch = assertTimelineMediaKindMatchesData({
      id: "voice",
      trackId: "audio",
      label: "Voice",
      kind: "audio",
      startMs: 0,
      durationMs: 1_000,
      data: { mediaType: "video" },
    });

    expect(mismatch).toEqual(
      expect.objectContaining({
        code: "mismatched_media_type",
        severity: "error",
      }),
    );
    expect(
      validateTimelineEditorMediaTypes({
        tracks: [
          {
            id: "audio",
            label: "Audio",
            items: [
              {
                id: "voice",
                trackId: "audio",
                label: "Voice",
                kind: "audio",
                startMs: 0,
                durationMs: 1_000,
                data: { mediaType: "video" },
              },
            ],
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        path: "tracks[0].items[0].data.mediaType",
        code: "mismatched_media_type",
      }),
    ]);
    expect(
      validateTimelineEditorMediaTypes({
        tracks: [
          {
            id: "custom",
            label: "Custom",
            items: [
              {
                id: "annotation",
                trackId: "custom",
                label: "Annotation",
                kind: "annotation",
                startMs: 0,
                durationMs: 1_000,
                data: { mediaType: "annotation" },
              },
            ],
          },
        ],
      }),
    ).toEqual([expect.objectContaining({ code: "invalid_media_type" })]);
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
    const documentWithData: TimelineEditorDocument = {
      durationMs: 8_000,
      tracks: [
        {
          ...tracks[0]!,
          items: [{ ...tracks[0]!.items[0]!, data: { priority: "high" } }],
        },
      ],
    };
    const serialized = serializeTimelineEditorDocument(document);

    expect(serialized.schemaVersion).toBe(1);
    expect(parseTimelineEditorDocument(serialized).tracks[0]?.items[0]?.id).toBe("brief");
    expect(migrateTimelineEditorDocument(document).schemaVersion).toBe(1);
    expect(
      migrateTimelineEditorDocument(serializeTimelineEditorDocument(documentWithData)).document
        .tracks[0]?.items[0]?.data,
    ).toEqual({ priority: "high" });
    expect(() => migrateTimelineEditorDocument({ schemaVersion: 99, document })).toThrowError(
      TimelineEditorMigrationError,
    );
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
