import { render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import {
  TimelineWorkbench,
  type TimelineEditorDocument,
  type TimelineEditorItemRenderContext,
  type TimelineWorkbenchSelection,
} from "@moritzbrantner/timeline-editor";

import { detectTimelineEditorOverlaps } from "../../operations/overlaps";
import { createTimelineWorkbenchItemLookup } from "./selection";

// Count lookup and overlap rebuilds without changing what they return.
vi.mock("../../operations/overlaps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../operations/overlaps")>();

  return { ...actual, detectTimelineEditorOverlaps: vi.fn(actual.detectTimelineEditorOverlaps) };
});
vi.mock("./selection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./selection")>();

  return {
    ...actual,
    createTimelineWorkbenchItemLookup: vi.fn(actual.createTimelineWorkbenchItemLookup),
  };
});

const overlapDetections = vi.mocked(detectTimelineEditorOverlaps);
const itemLookupBuilds = vi.mocked(createTimelineWorkbenchItemLookup);

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

beforeEach(() => {
  overlapDetections.mockClear();
  itemLookupBuilds.mockClear();
});

function createDocument(): TimelineEditorDocument {
  return {
    durationMs: 8_000,
    currentTimeMs: 0,
    tracks: [
      {
        id: "planning",
        label: "Planning",
        items: [
          { id: "brief", trackId: "planning", label: "Brief", startMs: 0, durationMs: 1_000 },
          { id: "draft", trackId: "planning", label: "Draft", startMs: 2_000, durationMs: 1_000 },
        ],
      },
    ],
  };
}

const renderedItemIds: string[] = [];

function renderTimelineItem({ item }: TimelineEditorItemRenderContext<Record<string, unknown>>) {
  renderedItemIds.push(item.id);
  return <span>{item.label}</span>;
}

const overlappingItem = {
  id: "overlap",
  trackId: "planning",
  label: "Overlap",
  startMs: 500,
  durationMs: 1_000,
};

describe("timeline workbench tracks snapshot contract", () => {
  test("playhead-only changes keep item lookups, overlaps and clips", () => {
    const document = createDocument();
    const { rerender } = render(
      <TimelineWorkbench
        document={document}
        selectedItemId="brief"
        renderTimelineItem={renderTimelineItem}
      />,
    );
    renderedItemIds.length = 0;
    overlapDetections.mockClear();
    itemLookupBuilds.mockClear();

    for (const currentTimeMs of [250, 500, 750]) {
      rerender(
        <TimelineWorkbench
          document={{ ...document, currentTimeMs }}
          selectedItemId="brief"
          renderTimelineItem={renderTimelineItem}
        />,
      );
    }

    expect(itemLookupBuilds).not.toHaveBeenCalled();
    expect(overlapDetections).not.toHaveBeenCalled();
    expect(renderedItemIds).toEqual([]);
  });

  test("replacing tracks updates overlaps and the selected item lookup", () => {
    const document = createDocument();
    const onSelectedItemChange = vi.fn<(selection: TimelineWorkbenchSelection | null) => void>();
    const { rerender } = render(
      <TimelineWorkbench
        document={document}
        selectedItemId="overlap"
        onSelectedItemChange={onSelectedItemChange}
      />,
    );
    expect(screen.getByText("0 overlaps")).toBeTruthy();

    const [track] = document.tracks;
    rerender(
      <TimelineWorkbench
        document={{
          ...document,
          tracks: [{ ...track!, items: [...track!.items, overlappingItem] }],
        }}
        selectedItemId="overlap"
        onSelectedItemChange={onSelectedItemChange}
      />,
    );

    expect(screen.getByText("1 overlaps")).toBeTruthy();
    // The inspector resolves the selected item through the rebuilt lookup.
    expect(screen.getAllByDisplayValue("Overlap").length).toBeGreaterThan(0);
  });

  test("in-place tracks mutation is unsupported: overlaps stay stale until tracks are replaced", () => {
    const document = createDocument();
    const { rerender } = render(<TimelineWorkbench document={document} />);

    // Unsupported: push into the same items array and pass only a new document object.
    document.tracks[0]!.items.push(overlappingItem);
    rerender(<TimelineWorkbench document={{ ...document }} />);

    expect(screen.getByText("0 overlaps")).toBeTruthy();

    // Replacing `tracks` (the supported contract) brings the overlap in.
    rerender(<TimelineWorkbench document={{ ...document, tracks: [...document.tracks] }} />);

    expect(screen.getByText("1 overlaps")).toBeTruthy();
  });
});
