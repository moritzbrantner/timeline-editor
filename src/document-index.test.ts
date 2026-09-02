import { describe, expect, it } from "vitest";

import {
  createTimelineEditorDocumentIndex,
  getTimelineEditorGroupedItemIdsFromIndex,
} from "./document-index";
import type { TimelineEditorDocument } from "./types";

const document: TimelineEditorDocument = {
  tracks: [
    {
      id: "video",
      label: "Video",
      items: [
        {
          id: "intro",
          trackId: "video",
          label: "Intro",
          startMs: 0,
          durationMs: 1_000,
          itemGroupId: "pair",
        },
        {
          id: "solo",
          trackId: "video",
          label: "Solo",
          startMs: 1_000,
          durationMs: 1_000,
        },
      ],
    },
    {
      id: "audio",
      label: "Audio",
      items: [
        {
          id: "intro-audio",
          trackId: "audio",
          label: "Intro audio",
          startMs: 0,
          durationMs: 1_000,
          itemGroupId: "pair",
        },
      ],
    },
  ],
};

describe("timeline document index", () => {
  it("indexes tracks, items, track positions, and item groups", () => {
    const index = createTimelineEditorDocumentIndex(document);

    expect(index.trackById.get("audio")?.label).toBe("Audio");
    expect(index.trackIndexById.get("video")).toBe(0);
    expect(index.trackIndexById.get("audio")).toBe(1);
    expect(index.itemById.get("solo")?.label).toBe("Solo");
    expect(index.trackByItemId.get("intro-audio")?.id).toBe("audio");
    expect(index.itemIdsByGroupId.get("pair")).toEqual(["intro", "intro-audio"]);
  });

  it("expands selected grouped items while preserving ungrouped and unknown ids", () => {
    const index = createTimelineEditorDocumentIndex(document);

    expect(getTimelineEditorGroupedItemIdsFromIndex(index, ["intro", "solo", "missing"])).toEqual([
      "intro",
      "solo",
      "missing",
      "intro-audio",
    ]);
  });
});
