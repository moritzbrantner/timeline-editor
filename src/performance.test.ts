import { describe, expect, test } from "vitest";

import { createTimelineEditorDocumentIndex } from "./document-index";
import {
  createTimelineEditorSnapOptions,
  createTimelineEditorSnapResolver,
  detectTimelineEditorOverlaps,
  moveTimelineEditorItems,
  normalizeTimelineEditorDocument,
  splitTimelineEditorItems,
  type TimelineEditorDocument,
} from "./core";

describe("timeline operation performance smoke coverage", () => {
  test("reports timings for large pure-operation scenarios", () => {
    const document = createSyntheticDocument({ trackCount: 100, itemsPerTrack: 50 });
    const selectedItemIds = document.tracks.slice(0, 20).map((track) => track.items[10]!.id);
    const timings = {
      normalize: timeOperation(() => normalizeTimelineEditorDocument(document)),
      overlapDetection: timeOperation(() => detectTimelineEditorOverlaps(document.tracks)),
      moveSelection: timeOperation(() =>
        moveTimelineEditorItems(document.tracks, selectedItemIds, 250, {
          durationMs: document.durationMs,
        }),
      ),
      splitSelection: timeOperation(() =>
        splitTimelineEditorItems(document.tracks, selectedItemIds, 55_250, {
          durationMs: document.durationMs,
        }),
      ),
      documentIndex: timeOperation(() => createTimelineEditorDocumentIndex(document)),
      snapResolution: timeOperation(() => {
        const resolver = createTimelineEditorSnapResolver(
          document,
          createTimelineEditorSnapOptions(100, {
            enabled: true,
            targets: [{ type: "interval", intervalMs: 100 }, { type: "item-edge" }],
          }),
          80,
        );

        for (let index = 0; index < 250; index += 1) {
          resolver(index * 137);
        }
      }),
    };

    process.stdout.write(`timeline operation timings ${JSON.stringify(timings)}\n`);

    expect(Object.values(timings).every((durationMs) => Number.isFinite(durationMs))).toBe(true);
  });
});

function createSyntheticDocument({
  itemsPerTrack,
  trackCount,
}: {
  itemsPerTrack: number;
  trackCount: number;
}): TimelineEditorDocument {
  return {
    durationMs: 10 * 60_000,
    currentTimeMs: 120_000,
    markers: Array.from({ length: 100 }, (_, index) => ({
      id: `marker-${index}`,
      label: `Marker ${index}`,
      timeMs: index * 5_000,
    })),
    groups: [
      {
        id: "collapsed-group",
        label: "Collapsed Group",
        trackIds: Array.from({ length: 10 }, (_, index) => `track-${index}`),
        collapsed: true,
      },
    ],
    tracks: Array.from({ length: trackCount }, (_, trackIndex) => ({
      id: `track-${trackIndex}`,
      label: `Track ${trackIndex}`,
      items: Array.from({ length: itemsPerTrack }, (_, itemIndex) => ({
        id: `track-${trackIndex}-item-${itemIndex}`,
        trackId: `track-${trackIndex}`,
        label: `Item ${trackIndex}-${itemIndex}`,
        startMs: itemIndex * 5_000,
        durationMs: 2_000,
      })),
    })),
  };
}

function timeOperation(operation: () => void) {
  const start = performance.now();

  operation();

  return Math.round((performance.now() - start) * 100) / 100;
}
